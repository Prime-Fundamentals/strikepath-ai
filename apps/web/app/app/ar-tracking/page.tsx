"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icons";
import { apiFetch } from "@/lib/api";
import type { ARPoint, ARTrackingCapture, ARTrackingCaptureInput, Session } from "@/lib/types";

const calibrationLabels = ["Near left", "Near right", "Far left", "Far right"];
const pathLabels = ["Laydown", "Target", "Breakpoint", "Pocket"];

type CaptureMode = "camera" | "upload";
type MarkingStage = "calibration" | "path";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatBoard(value: number | undefined) {
  if (value === undefined) return "—";
  return value.toFixed(value % 1 === 0 ? 0 : 1);
}

function deriveBoard(point: ARPoint, calibration: ARPoint[]) {
  if (calibration.length < 4) return null;
  const [nearLeft, nearRight, farLeft, farRight] = calibration;
  const denominator = nearLeft.y - farLeft.y;
  const t = denominator === 0 ? 0.5 : clamp((point.y - farLeft.y) / denominator, 0, 1);
  const leftX = farLeft.x + (nearLeft.x - farLeft.x) * t;
  const rightX = farRight.x + (nearRight.x - farRight.x) * t;
  const width = Math.max(0.001, rightX - leftX);
  const ratio = clamp((point.x - leftX) / width, 0, 1);
  return Math.round((39 - ratio * 38) * 2) / 2;
}

function polyline(points: ARPoint[], width: number, height: number) {
  return points.map((point) => `${point.x * width},${point.y * height}`).join(" ");
}

function calibrationPolygon(points: ARPoint[], width: number, height: number) {
  if (points.length < 4) return "";
  const [nearLeft, nearRight, farLeft, farRight] = points;
  return [farLeft, farRight, nearRight, nearLeft].map((point) => `${point.x * width},${point.y * height}`).join(" ");
}

export default function ARTrackingPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartedRef = useRef<number | null>(null);

  const [mode, setMode] = useState<CaptureMode>("camera");
  const [stage, setStage] = useState<MarkingStage>("calibration");
  const [calibration, setCalibration] = useState<ARPoint[]>([]);
  const [pathPoints, setPathPoints] = useState<ARPoint[]>([]);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaDuration, setMediaDuration] = useState<number | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [recording, setRecording] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [deviceLabel, setDeviceLabel] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [captures, setCaptures] = useState<ARTrackingCapture[]>([]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const secureCameraAvailable = typeof window === "undefined" || window.isSecureContext || window.location.hostname === "localhost";

  const derivedBoards = useMemo(() => {
    const result: Record<string, number> = {};
    pathPoints.forEach((point) => {
      const board = deriveBoard(point, calibration);
      if (board !== null) result[point.label.toLowerCase()] = board;
    });
    return result;
  }, [calibration, pathPoints]);

  const loadData = useCallback(async () => {
    try {
      const [sessionRows, captureRows] = await Promise.all([
        apiFetch<Session[]>("/api/sessions"),
        apiFetch<ARTrackingCapture[]>("/api/ar/captures"),
      ]);
      setSessions(sessionRows);
      setCaptures(captureRows);
      const active = sessionRows.find((item) => item.status === "active");
      if (active) setSessionId(active.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load AR tracking data.");
    }
  }, []);

  useEffect(() => {
    void loadData();
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    };
  }, [loadData]);

  useEffect(() => {
    if (!videoRef.current) return;
    if (mediaUrl) {
      videoRef.current.srcObject = null;
      videoRef.current.src = mediaUrl;
      videoRef.current.load();
    }
  }, [mediaUrl]);

  function resetMarks() {
    setCalibration([]);
    setPathPoints([]);
    setStage("calibration");
    setMessage("");
  }

  async function startCamera() {
    setError("");
    setMessage("");
    if (!secureCameraAvailable) {
      setError("Camera access requires HTTPS or localhost.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser does not expose camera access. Use video upload mode instead.");
      return;
    }

    try {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      setDeviceLabel(track?.label || "Rear camera");
      setMode("camera");
      setCameraActive(true);
      setMediaUrl(null);
      setMediaDuration(null);
      resetMarks();
      if (videoRef.current) {
        videoRef.current.src = "";
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        await videoRef.current.play();
        setPlaying(true);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Camera permission was denied or the camera is unavailable.");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    setCameraActive(false);
    setRecording(false);
    setPlaying(false);
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  function startRecording() {
    const stream = streamRef.current;
    if (!stream) {
      setError("Start the camera before recording a shot.");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      setError("Video recording is not supported in this browser. Use the live preview or upload a video.");
      return;
    }

    try {
      const recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm" });
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" });
        const nextUrl = URL.createObjectURL(blob);
        setMediaUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return nextUrl;
        });
        const started = recordingStartedRef.current;
        setMediaDuration(started ? Math.max(0, (Date.now() - started) / 1000) : null);
        recordingStartedRef.current = null;
        stopCamera();
        setMessage("Shot recorded. Play the clip, calibrate the lane, then mark the four path points.");
      };
      recorderRef.current = recorder;
      recordingStartedRef.current = Date.now();
      recorder.start(200);
      setRecording(true);
      setMessage("Recording shot… keep the phone stable and capture the full lane.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to start recording.");
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recorder.stop();
    setRecording(false);
  }

  function handleUpload(file: File | null) {
    if (!file) return;
    stopCamera();
    const nextUrl = URL.createObjectURL(file);
    setMediaUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return nextUrl;
    });
    setMode("upload");
    setDeviceLabel(file.name);
    setMediaDuration(null);
    resetMarks();
    setMessage("Video loaded. Calibrate the lane using the four corners.");
  }

  function togglePlayback() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play();
      setPlaying(true);
    } else {
      video.pause();
      setPlaying(false);
    }
  }

  function handleOverlayClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!videoRef.current && !cameraActive) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const point = {
      x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
      y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
    };

    if (stage === "calibration") {
      if (calibration.length >= calibrationLabels.length) return;
      const next = [...calibration, { ...point, label: calibrationLabels[calibration.length] }];
      setCalibration(next);
      if (next.length === calibrationLabels.length) {
        setStage("path");
        setMessage("Lane calibrated. Mark Laydown, Target, Breakpoint, then Pocket.");
      }
      return;
    }

    if (pathPoints.length >= pathLabels.length) return;
    const next = [...pathPoints, { ...point, label: pathLabels[pathPoints.length] }];
    setPathPoints(next);
    if (next.length === pathLabels.length) {
      setMessage("Path captured. Review the estimated boards and save the analysis.");
    }
  }

  function undoPoint() {
    if (stage === "path" && pathPoints.length > 0) {
      setPathPoints((current) => current.slice(0, -1));
      return;
    }
    if (stage === "path" && pathPoints.length === 0) {
      setStage("calibration");
    }
    setCalibration((current) => current.slice(0, -1));
  }

  async function saveCapture() {
    if (calibration.length !== 4 || pathPoints.length !== 4) {
      setError("Complete the four calibration points and four path points before saving.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const payload: ARTrackingCaptureInput = {
        session_id: sessionId,
        source_type: mode,
        status: "reviewed",
        device_label: deviceLabel,
        calibration_points: calibration,
        path_points: pathPoints,
        derived_boards: derivedBoards,
        media_duration_sec: mediaDuration,
        media_key: null,
        notes: notes || null,
      };
      const created = await apiFetch<ARTrackingCapture>("/api/ar/captures", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setCaptures((current) => [created, ...current]);
      setMessage(`AR analysis #${created.id} saved. The video remains local on this device in this beta.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save AR analysis.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteCapture(captureId: number) {
    if (!confirm("Delete this AR tracking analysis?")) return;
    await apiFetch<void>(`/api/ar/captures/${captureId}`, { method: "DELETE" });
    setCaptures((current) => current.filter((capture) => capture.id !== captureId));
  }

  const overlayWidth = 1000;
  const overlayHeight = 562.5;
  const activeInstruction = stage === "calibration"
    ? calibrationLabels[calibration.length] ?? "Calibration complete"
    : pathLabels[pathPoints.length] ?? "Path complete";

  return (
    <div className="page-content ar-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow small"><Icon name="camera" width={16} />AR tracking beta</span>
          <h1>Camera-assisted shot tracking</h1>
          <p>Record or upload a lane video, calibrate the lane perspective, and convert four visual path points into estimated board positions.</p>
        </div>
        <div className="ar-beta-pill">Guided calibration MVP</div>
      </div>

      {!secureCameraAvailable && <div className="error-banner">Live camera access requires HTTPS. Railway’s public domain will work; plain HTTP on another device will not.</div>}
      {error && <div className="error-banner">{error}</div>}
      {message && <div className="success-banner">{message}</div>}

      <div className="ar-layout">
        <section className="glass-panel ar-stage-panel">
          <div className="panel-heading">
            <div><small>CAMERA / VIDEO VIEW</small><h2>Lane calibration workspace</h2></div>
            <span className="lane-mode">{mode === "camera" ? "Live camera" : "Uploaded clip"}</span>
          </div>

          <div className="ar-video-shell">
            <video
              ref={videoRef}
              className="ar-video"
              autoPlay={cameraActive}
              muted={cameraActive}
              playsInline
              onLoadedMetadata={(event) => {
                if (!mediaDuration && Number.isFinite(event.currentTarget.duration)) setMediaDuration(event.currentTarget.duration);
              }}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
            />
            {!cameraActive && !mediaUrl && (
              <div className="ar-video-placeholder">
                <Icon name="camera" width={48} />
                <h3>Start the rear camera or upload a lane video</h3>
                <p>Best results come from a stable phone placed behind the approach with the full lane visible.</p>
              </div>
            )}
            {(cameraActive || mediaUrl) && (
              <div className={`ar-overlay ${stage}`} onClick={handleOverlayClick} role="button" tabIndex={0} aria-label={`Place ${activeInstruction} point`}>
                <svg viewBox={`0 0 ${overlayWidth} ${overlayHeight}`} preserveAspectRatio="none">
                  {calibration.length === 4 && (
                    <>
                      <polygon points={calibrationPolygon(calibration, overlayWidth, overlayHeight)} fill="rgba(0,237,247,.07)" stroke="#62f6ff" strokeWidth="3" />
                      {[0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875].map((ratio) => {
                        const [nearLeft, nearRight, farLeft, farRight] = calibration;
                        const nearX = (nearLeft.x + (nearRight.x - nearLeft.x) * ratio) * overlayWidth;
                        const nearY = (nearLeft.y + (nearRight.y - nearLeft.y) * ratio) * overlayHeight;
                        const farX = (farLeft.x + (farRight.x - farLeft.x) * ratio) * overlayWidth;
                        const farY = (farLeft.y + (farRight.y - farLeft.y) * ratio) * overlayHeight;
                        return <line key={ratio} x1={farX} y1={farY} x2={nearX} y2={nearY} stroke="rgba(255,255,255,.28)" strokeWidth="1.5" strokeDasharray="8 8" />;
                      })}
                    </>
                  )}

                  {calibration.map((point, index) => (
                    <g key={`${point.label}-${index}`}>
                      <circle cx={point.x * overlayWidth} cy={point.y * overlayHeight} r="10" fill="#00eaf5" stroke="#ffffff" strokeWidth="4" />
                      <rect x={point.x * overlayWidth + 14} y={point.y * overlayHeight - 17} width="110" height="28" rx="14" fill="rgba(3,15,24,.9)" stroke="#00eaf5" />
                      <text x={point.x * overlayWidth + 69} y={point.y * overlayHeight + 2} textAnchor="middle" fill="#ffffff" fontSize="15" fontWeight="800">{point.label}</text>
                    </g>
                  ))}

                  {pathPoints.length > 1 && <polyline points={polyline(pathPoints, overlayWidth, overlayHeight)} fill="none" stroke="#ffc663" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />}
                  {pathPoints.map((point, index) => (
                    <g key={`${point.label}-${index}`}>
                      <circle cx={point.x * overlayWidth} cy={point.y * overlayHeight} r="12" fill="#ffc663" stroke="#ffffff" strokeWidth="4" />
                      <rect x={point.x * overlayWidth + 15} y={point.y * overlayHeight - 18} width="145" height="30" rx="15" fill="rgba(3,15,24,.92)" stroke="#ffc663" />
                      <text x={point.x * overlayWidth + 87} y={point.y * overlayHeight + 3} textAnchor="middle" fill="#ffffff" fontSize="15" fontWeight="800">
                        {point.label} • {formatBoard(deriveBoard(point, calibration) ?? undefined)}
                      </text>
                    </g>
                  ))}
                </svg>
                <div className="ar-instruction"><small>{stage === "calibration" ? "CALIBRATION" : "SHOT PATH"}</small><strong>Tap: {activeInstruction}</strong></div>
              </div>
            )}
          </div>

          <div className="ar-stage-controls">
            <button type="button" className="primary-button small" onClick={startCamera} disabled={recording}><Icon name="camera" width={17} />Start camera</button>
            {cameraActive && !recording && <button type="button" className="secondary-button small" onClick={startRecording}>Record shot</button>}
            {recording && <button type="button" className="danger-button small recording" onClick={stopRecording}><span className="record-dot" />Stop recording</button>}
            {(mediaUrl || cameraActive) && <button type="button" className="secondary-button small" onClick={togglePlayback}>{playing ? "Pause" : "Play"}</button>}
            <label className="secondary-button small ar-upload-button">
              Upload video
              <input type="file" accept="video/*" onChange={(event) => handleUpload(event.target.files?.[0] ?? null)} />
            </label>
            <button type="button" className="secondary-button small" onClick={undoPoint} disabled={!calibration.length && !pathPoints.length}>Undo point</button>
            <button type="button" className="secondary-button small" onClick={resetMarks}>Reset marks</button>
          </div>
        </section>

        <aside className="ar-sidebar">
          <section className="glass-panel ar-setup-card">
            <div className="panel-heading"><div><small>CAPTURE SETUP</small><h2>Analysis details</h2></div></div>
            <label className="field"><span>Attach to session</span><select value={sessionId ?? ""} onChange={(event) => setSessionId(event.target.value ? Number(event.target.value) : null)}><option value="">No session</option>{sessions.map((session) => <option key={session.id} value={session.id}>{session.center_name} • Lane {session.lane_number || "—"} • {session.status}</option>)}</select></label>
            <label className="field"><span>Notes</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Camera position, lane, delivery, or tracking notes" /></label>
            <div className="ar-progress-list">
              <div className={calibration.length === 4 ? "done" : "active"}><span>1</span><p><strong>Calibrate lane</strong><small>{calibration.length}/4 corners</small></p></div>
              <div className={pathPoints.length === 4 ? "done" : stage === "path" ? "active" : ""}><span>2</span><p><strong>Mark ball path</strong><small>{pathPoints.length}/4 points</small></p></div>
              <div className={pathPoints.length === 4 ? "active" : ""}><span>3</span><p><strong>Review boards</strong><small>Confirm before saving</small></p></div>
            </div>
          </section>

          <section className="glass-panel ar-board-results">
            <div className="panel-heading"><div><small>ESTIMATED RESULT</small><h2>Board positions</h2></div></div>
            <div className="ar-result-grid">
              {pathLabels.map((label) => <div key={label}><small>{label}</small><strong>{formatBoard(derivedBoards[label.toLowerCase()])}</strong></div>)}
            </div>
            <p>These values are perspective estimates from your manual calibration. Review them before using them as shot telemetry.</p>
            <button type="button" className="primary-button wide" disabled={busy || calibration.length !== 4 || pathPoints.length !== 4} onClick={saveCapture}>{busy ? "Saving analysis…" : "Save AR analysis"}</button>
          </section>

          <section className="glass-panel ar-safety-card">
            <Icon name="spark" width={22} />
            <div><strong>Tracking beta boundary</strong><p>This release does not claim automatic ball detection yet. It provides camera capture, perspective calibration, AR overlays, board estimation, and saved review data—the foundation required before computer-vision automation.</p></div>
          </section>
        </aside>
      </div>

      <section className="glass-panel ar-history">
        <div className="panel-heading"><div><small>SAVED ANALYSES</small><h2>Recent AR captures</h2></div></div>
        <div className="ar-history-grid">
          {captures.slice(0, 8).map((capture) => (
            <article key={capture.id}>
              <div><span>#{capture.id}</span><small>{capture.source_type} • {new Date(capture.created_at).toLocaleString()}</small></div>
              <strong>Laydown {formatBoard(capture.derived_boards.laydown)} → Target {formatBoard(capture.derived_boards.target)}</strong>
              <p>Breakpoint {formatBoard(capture.derived_boards.breakpoint)} • Pocket {formatBoard(capture.derived_boards.pocket)}</p>
              <button type="button" onClick={() => void deleteCapture(capture.id)}>Delete</button>
            </article>
          ))}
          {!captures.length && <p className="strip-empty">No saved AR analyses yet.</p>}
        </div>
      </section>

      <section className="ar-roadmap">
        <article className="glass-panel"><span>Phase 1 • Included</span><h3>Guided camera tracking</h3><p>Video capture, lane calibration, AR guides, manual path points, board estimates, and saved analysis records.</p></article>
        <article className="glass-panel"><span>Phase 2</span><h3>Computer-vision assist</h3><p>Automatic lane-edge detection, ball candidate tracking, confidence scoring, and user correction tools.</p></article>
        <article className="glass-panel"><span>Phase 3</span><h3>Native live AR</h3><p>Real-time overlays, speed and entry-angle estimates, and dedicated iOS/Android capture performance.</p></article>
      </section>
    </div>
  );
}
