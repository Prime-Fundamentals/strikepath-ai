"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icons";
import { useAuth } from "@/components/AuthProvider";
import { apiFetch } from "@/lib/api";
import {
  analyzeBallMotion,
  autoDetectBowlingShot,
  deriveBoardFromCalibration,
  suggestLaneCalibration,
  type ARVisionPoint,
  type DetectedShotEvent,
} from "@/lib/arVision";
import type { ARPoint, ARTrackingCapture, ARTrackingCaptureInput, Session } from "@/lib/types";
import { handLabel, toDisplayBoard } from "@/lib/boards";

const calibrationLabels = ["Near left", "Near right", "Far left", "Far right"];
const pathLabels = ["Laydown", "Target", "Breakpoint", "Pocket"];

type CaptureMode = "camera" | "upload";
type MarkingStage = "calibration" | "path";
type TrackingMode = "manual" | "assisted";
type DragPoint = { kind: "calibration" | "path"; index: number; pointerId: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatBoard(value: number | undefined) {
  if (value === undefined) return "—";
  return value.toFixed(value % 1 === 0 ? 0 : 1);
}

function formatMetric(value: number | null, suffix: string) {
  return value === null ? "—" : `${value.toFixed(1)} ${suffix}`;
}

function polyline(points: Array<{ x: number; y: number }>, width: number, height: number) {
  return points.map((point) => `${point.x * width},${point.y * height}`).join(" ");
}

function calibrationPolygon(points: ARPoint[], width: number, height: number) {
  if (points.length < 4) return "";
  const [nearLeft, nearRight, farLeft, farRight] = points;
  return [farLeft, farRight, nearRight, nearLeft].map((point) => `${point.x * width},${point.y * height}`).join(" ");
}

export default function ARTrackingPage() {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const analysisCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartedRef = useRef<number | null>(null);
  const dragPointRef = useRef<DragPoint | null>(null);
  const suppressOverlayClickRef = useRef(false);

  const [mode, setMode] = useState<CaptureMode>("camera");
  const [stage, setStage] = useState<MarkingStage>("calibration");
  const [trackingMode, setTrackingMode] = useState<TrackingMode>("manual");
  const [calibration, setCalibration] = useState<ARPoint[]>([]);
  const [pathPoints, setPathPoints] = useState<ARPoint[]>([]);
  const [autoTrackPoints, setAutoTrackPoints] = useState<ARVisionPoint[]>([]);
  const [detectedEvents, setDetectedEvents] = useState<DetectedShotEvent[]>([]);
  const [trackingConfidence, setTrackingConfidence] = useState<number | null>(null);
  const [estimatedSpeedMph, setEstimatedSpeedMph] = useState<number | null>(null);
  const [estimatedEntryAngleDeg, setEstimatedEntryAngleDeg] = useState<number | null>(null);
  const [calibrationConfidence, setCalibrationConfidence] = useState<number | null>(null);
  const [calibrationExplanation, setCalibrationExplanation] = useState("");
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStatus, setAnalysisStatus] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaDuration, setMediaDuration] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
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
      const board = deriveBoardFromCalibration(point, calibration);
      if (board !== null) result[point.label.toLowerCase()] = board;
    });
    if (estimatedSpeedMph !== null) result.speed_mph = estimatedSpeedMph;
    if (estimatedEntryAngleDeg !== null) result.entry_angle_deg = estimatedEntryAngleDeg;
    if (trackingConfidence !== null) result.tracking_confidence = trackingConfidence;
    return result;
  }, [calibration, pathPoints, estimatedSpeedMph, estimatedEntryAngleDeg, trackingConfidence]);

  const displayBoard = useCallback((value: number | undefined) => {
    if (value === undefined) return undefined;
    return toDisplayBoard(value, user?.handedness || "right");
  }, [user?.handedness]);

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
    };
  }, [loadData]);

  useEffect(() => {
    return () => {
      if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    };
  }, [mediaUrl]);

  useEffect(() => {
    if (!videoRef.current || !mediaUrl) return;
    videoRef.current.srcObject = null;
    videoRef.current.src = mediaUrl;
    videoRef.current.load();
  }, [mediaUrl]);

  function clearAssistedResult() {
    setAutoTrackPoints([]);
    setTrackingConfidence(null);
    setEstimatedSpeedMph(null);
    setEstimatedEntryAngleDeg(null);
    setAnalysisProgress(0);
    setAnalysisStatus("");
    setDetectedEvents([]);
    setTrackingMode("manual");
  }

  function resetMarks() {
    setCalibration([]);
    setPathPoints([]);
    setStage("calibration");
    setCalibrationConfidence(null);
    setCalibrationExplanation("");
    clearAssistedResult();
    setMessage("");
  }

  function resetPathOnly() {
    setPathPoints([]);
    setStage("path");
    clearAssistedResult();
    setMessage("Manual path correction enabled. Mark Laydown, Target, Breakpoint, and Pocket.");
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
      setCurrentTime(0);
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
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm",
      });
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
        setMessage("Shot recorded. Review the clip, confirm lane calibration, then run assisted tracking or mark the path manually.");
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
    setCurrentTime(0);
    resetMarks();
    setMessage("Video loaded. Pause on a clear lane frame, suggest or mark the four lane corners, then run assisted tracking.");
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

  function normalizedPoint(event: React.PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
      y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
    };
  }

  function handleOverlayClick(event: React.MouseEvent<HTMLDivElement>) {
    if (suppressOverlayClickRef.current) {
      suppressOverlayClickRef.current = false;
      return;
    }
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
      setCalibrationConfidence(null);
      setCalibrationExplanation("");
      clearAssistedResult();
      if (next.length === calibrationLabels.length) {
        setStage("path");
        setMessage("Lane calibrated. Run assisted tracking or mark Laydown, Target, Breakpoint, and Pocket manually.");
      }
      return;
    }

    if (pathPoints.length >= pathLabels.length) return;
    clearAssistedResult();
    const next = [...pathPoints, { ...point, label: pathLabels[pathPoints.length] }];
    setPathPoints(next);
    if (next.length === pathLabels.length) {
      setMessage("Manual path captured. Review the estimated boards and save the analysis.");
    }
  }

  function beginPointDrag(kind: "calibration" | "path", index: number, event: React.PointerEvent<SVGGElement>) {
    event.preventDefault();
    event.stopPropagation();
    dragPointRef.current = { kind, index, pointerId: event.pointerId };
    suppressOverlayClickRef.current = true;
    try {
      overlayRef.current?.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture may not be supported in every embedded browser.
    }
  }

  function handleOverlayPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragPointRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const point = normalizedPoint(event);
    if (drag.kind === "calibration") {
      setCalibration((current) => current.map((item, index) => index === drag.index ? { ...item, ...point } : item));
      setCalibrationConfidence(null);
      setCalibrationExplanation("Calibration was manually adjusted.");
      clearAssistedResult();
    } else {
      setPathPoints((current) => current.map((item, index) => index === drag.index ? { ...item, ...point } : item));
      setTrackingMode("manual");
      setTrackingConfidence(null);
      setEstimatedSpeedMph(null);
      setEstimatedEntryAngleDeg(null);
    }
  }

  function endPointDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragPointRef.current || dragPointRef.current.pointerId !== event.pointerId) return;
    try {
      overlayRef.current?.releasePointerCapture(event.pointerId);
    } catch {
      // No-op.
    }
    dragPointRef.current = null;
    window.setTimeout(() => {
      suppressOverlayClickRef.current = false;
    }, 0);
  }

  function undoPoint() {
    clearAssistedResult();
    if (stage === "path" && pathPoints.length > 0) {
      setPathPoints((current) => current.slice(0, -1));
      return;
    }
    if (stage === "path" && pathPoints.length === 0) setStage("calibration");
    setCalibration((current) => current.slice(0, -1));
  }

  async function suggestCorners() {
    if (!videoRef.current || !analysisCanvasRef.current) return;
    setError("");
    try {
      const result = await suggestLaneCalibration(videoRef.current, analysisCanvasRef.current);
      setCalibration(result.points);
      setCalibrationConfidence(result.confidence);
      setCalibrationExplanation(result.explanation);
      setStage("path");
      setPathPoints([]);
      clearAssistedResult();
      setMessage(`Lane corner suggestion created at ${Math.round(result.confidence * 100)}% confidence. Drag each corner to the actual lane edges before analyzing.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to suggest lane corners.");
    }
  }

  async function runAutomaticDetection() {
    if (!videoRef.current || !analysisCanvasRef.current || !mediaUrl) {
      setError("Record or upload a video before running automatic shot detection.");
      return;
    }
    setError("");
    setMessage("");
    setAnalyzing(true);
    setAnalysisProgress(0);
    setAnalysisStatus("Starting automatic detection…");
    try {
      const result = await autoDetectBowlingShot(
        videoRef.current,
        analysisCanvasRef.current,
        (progress, status) => {
          setAnalysisProgress(progress);
          setAnalysisStatus(status);
        },
      );
      setCalibration(result.calibration);
      setCalibrationConfidence(result.calibrationConfidence);
      setCalibrationExplanation(result.calibrationExplanation);
      setAutoTrackPoints(result.tracking.trackPoints);
      setDetectedEvents(result.tracking.events);
      setPathPoints(result.tracking.keyPoints);
      setTrackingMode("assisted");
      setTrackingConfidence(result.combinedConfidence);
      setEstimatedSpeedMph(result.tracking.estimatedSpeedMph);
      setEstimatedEntryAngleDeg(result.tracking.estimatedEntryAngleDeg);
      setStage("path");
      setMessage(`Automatic shot detection completed at ${Math.round(result.combinedConfidence * 100)}% confidence. Review the lane corners and gold event points before saving.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to automatically detect the shot.");
      setAnalysisStatus("");
    } finally {
      setAnalyzing(false);
    }
  }

  async function runAssistedTracking() {
    if (!videoRef.current || !analysisCanvasRef.current || !mediaUrl) {
      setError("Record or upload a video before running assisted tracking.");
      return;
    }
    if (calibration.length !== 4) {
      setError("Confirm all four lane corners before running assisted tracking.");
      return;
    }
    setError("");
    setMessage("");
    setAnalyzing(true);
    setAnalysisProgress(0);
    setAnalysisStatus("Preparing video analysis…");
    try {
      const result = await analyzeBallMotion(
        videoRef.current,
        analysisCanvasRef.current,
        calibration,
        (progress, status) => {
          setAnalysisProgress(progress);
          setAnalysisStatus(status);
        },
      );
      setAutoTrackPoints(result.trackPoints);
      setDetectedEvents(result.events);
      setPathPoints(result.keyPoints);
      setTrackingMode("assisted");
      setTrackingConfidence(result.confidence);
      setEstimatedSpeedMph(result.estimatedSpeedMph);
      setEstimatedEntryAngleDeg(result.estimatedEntryAngleDeg);
      setStage("path");
      setMessage(`Assisted track created at ${Math.round(result.confidence * 100)}% confidence. Drag any gold key point that needs correction before saving.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to analyze the ball path.");
      setAnalysisStatus("");
    } finally {
      setAnalyzing(false);
    }
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
        tracking_mode: trackingMode,
        tracking_confidence: trackingConfidence,
        auto_track_points: autoTrackPoints.map(({ x, y, label }) => ({ x, y, label })),
        estimated_speed_mph: estimatedSpeedMph,
        estimated_entry_angle_deg: estimatedEntryAngleDeg,
        media_duration_sec: mediaDuration,
        media_key: null,
        notes: notes || null,
      };
      const created = await apiFetch<ARTrackingCapture>("/api/ar/captures", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setCaptures((current) => [created, ...current]);
      setMessage(`AR analysis #${created.id} saved. The source video remains local on this device in this beta.`);
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
          <span className="eyebrow small"><Icon name="camera" width={16} />AR tracking phase 2</span>
          <h1>Assisted computer-vision tracking</h1>
          <p>Record or upload a lane video, calibrate the lane, run local motion analysis, and correct the detected path before saving.</p>
        </div>
        <div className="ar-heading-badges"><div className="ar-beta-pill">Local vision assist beta</div><div className="ar-hand-pill">{handLabel(user?.handedness || "right")} boards</div></div>
      </div>

      {!secureCameraAvailable && <div className="error-banner">Live camera access requires HTTPS. Railway’s public domain will work; plain HTTP on another device will not.</div>}
      {error && <div className="error-banner">{error}</div>}
      {message && <div className="success-banner">{message}</div>}

      <div className="ar-layout">
        <section className="glass-panel ar-stage-panel">
          <div className="panel-heading">
            <div><small>CAMERA / VIDEO VIEW</small><h2>Lane and ball tracking workspace</h2></div>
            <span className="lane-mode">{trackingMode === "assisted" ? "Assisted track" : mode === "camera" ? "Live camera" : "Uploaded clip"}</span>
          </div>
          <div className="ar-hand-orientation">
            <span>{user?.handedness === "left" ? "Left gutter" : "Opposite gutter"}</span>
            <div>{[39,35,30,25,20,15,10,5,1].map((physical) => <b key={physical}>{user?.handedness === "left" ? 40 - physical : physical}</b>)}</div>
            <span>{user?.handedness === "left" ? "Opposite gutter" : "Right gutter"}</span>
          </div>

          <div className="ar-video-shell">
            <video
              ref={videoRef}
              className="ar-video"
              autoPlay={cameraActive}
              muted={cameraActive}
              playsInline
              onLoadedMetadata={(event) => {
                if (Number.isFinite(event.currentTarget.duration)) setMediaDuration(event.currentTarget.duration);
              }}
              onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
            />
            <canvas ref={analysisCanvasRef} className="ar-analysis-canvas" aria-hidden="true" />
            {!cameraActive && !mediaUrl && (
              <div className="ar-video-placeholder">
                <Icon name="camera" width={48} />
                <h3>Start the rear camera or upload a lane video</h3>
                <p>Use a fixed landscape phone behind the approach with the foul line, lane edges, and pin deck visible.</p>
              </div>
            )}
            {(cameraActive || mediaUrl) && (
              <div
                ref={overlayRef}
                className={`ar-overlay ${stage}`}
                onClick={handleOverlayClick}
                onPointerMove={handleOverlayPointerMove}
                onPointerUp={endPointDrag}
                onPointerCancel={endPointDrag}
                role="button"
                tabIndex={0}
                aria-label={`Place ${activeInstruction} point`}
              >
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

                  {autoTrackPoints.length > 1 && (
                    <polyline
                      points={polyline(autoTrackPoints, overlayWidth, overlayHeight)}
                      fill="none"
                      stroke="#59e8ff"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity=".78"
                    />
                  )}
                  {autoTrackPoints.filter((_, index) => index % Math.max(1, Math.floor(autoTrackPoints.length / 18)) === 0).map((point, index) => (
                    <circle key={`auto-${index}`} cx={point.x * overlayWidth} cy={point.y * overlayHeight} r="4" fill="#59e8ff" opacity=".8" />
                  ))}

                  {calibration.map((point, index) => (
                    <g key={`${point.label}-${index}`} className="ar-draggable-point" onPointerDown={(event) => beginPointDrag("calibration", index, event)}>
                      <circle cx={point.x * overlayWidth} cy={point.y * overlayHeight} r="11" fill="#00eaf5" stroke="#ffffff" strokeWidth="4" />
                      <rect x={point.x * overlayWidth + 14} y={point.y * overlayHeight - 17} width="110" height="28" rx="14" fill="rgba(3,15,24,.9)" stroke="#00eaf5" />
                      <text x={point.x * overlayWidth + 69} y={point.y * overlayHeight + 2} textAnchor="middle" fill="#ffffff" fontSize="15" fontWeight="800">{point.label}</text>
                    </g>
                  ))}

                  {pathPoints.length > 1 && <polyline points={polyline(pathPoints, overlayWidth, overlayHeight)} fill="none" stroke="#ffc663" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />}
                  {pathPoints.map((point, index) => (
                    <g key={`${point.label}-${index}`} className="ar-draggable-point" onPointerDown={(event) => beginPointDrag("path", index, event)}>
                      <circle cx={point.x * overlayWidth} cy={point.y * overlayHeight} r="13" fill="#ffc663" stroke="#ffffff" strokeWidth="4" />
                      <rect x={point.x * overlayWidth + 15} y={point.y * overlayHeight - 18} width="145" height="30" rx="15" fill="rgba(3,15,24,.92)" stroke="#ffc663" />
                      <text x={point.x * overlayWidth + 87} y={point.y * overlayHeight + 3} textAnchor="middle" fill="#ffffff" fontSize="15" fontWeight="800">
                        {point.label} • {formatBoard(displayBoard(deriveBoardFromCalibration(point, calibration) ?? undefined))}
                      </text>
                    </g>
                  ))}
                </svg>
                <div className="ar-instruction"><small>{stage === "calibration" ? "CALIBRATION" : trackingMode === "assisted" ? "ASSISTED TRACK" : "SHOT PATH"}</small><strong>{pathPoints.length === 4 ? "Drag points to correct" : `Tap: ${activeInstruction}`}</strong></div>
              </div>
            )}
          </div>

          {mediaUrl && mediaDuration && (
            <div className="ar-timeline">
              <span>{currentTime.toFixed(1)}s</span>
              <input
                type="range"
                min={0}
                max={mediaDuration}
                step={0.02}
                value={Math.min(currentTime, mediaDuration)}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setCurrentTime(value);
                  if (videoRef.current) videoRef.current.currentTime = value;
                }}
              />
              <span>{mediaDuration.toFixed(1)}s</span>
            </div>
          )}

          <div className="ar-stage-controls">
            <button type="button" className="primary-button small" onClick={startCamera} disabled={recording || analyzing}><Icon name="camera" width={17} />Start camera</button>
            {cameraActive && !recording && <button type="button" className="secondary-button small" onClick={startRecording}>Record shot</button>}
            {recording && <button type="button" className="danger-button small recording" onClick={stopRecording}><span className="record-dot" />Stop recording</button>}
            {(mediaUrl || cameraActive) && <button type="button" className="secondary-button small" onClick={togglePlayback}>{playing ? "Pause" : "Play"}</button>}
            <label className="secondary-button small ar-upload-button">Upload video<input type="file" accept="video/*" onChange={(event) => handleUpload(event.target.files?.[0] ?? null)} /></label>
            <button type="button" className="secondary-button small" onClick={undoPoint} disabled={!calibration.length && !pathPoints.length}>Undo point</button>
            <button type="button" className="secondary-button small" onClick={resetMarks}>Reset all</button>
          </div>
        </section>

        <aside className="ar-sidebar">
          <section className="glass-panel ar-assist-card">
            <div className="panel-heading"><div><small>VISION ASSIST</small><h2>Local analysis tools</h2></div></div>
            <p>These tools run inside your browser. The video is not uploaded to the API during this beta.</p>
            <button type="button" className="primary-button wide ar-auto-detect" onClick={() => void runAutomaticDetection()} disabled={analyzing || !mediaUrl}>
              {analyzing ? "Detecting shot…" : "Automatic full-shot detection"}
            </button>
            <small className="ar-auto-note">One tap detects lane boundaries, release, arrows, breakpoint, pocket, speed, and entry angle.</small>
            <button type="button" className="secondary-button wide" onClick={() => void suggestCorners()} disabled={analyzing || (!cameraActive && !mediaUrl)}>Suggest lane corners only</button>
            {calibrationConfidence !== null && (
              <div className="ar-confidence-box">
                <span>Corner suggestion confidence</span><strong>{Math.round(calibrationConfidence * 100)}%</strong>
                <p>{calibrationExplanation}</p>
              </div>
            )}
            <button type="button" className="primary-button wide" onClick={() => void runAssistedTracking()} disabled={analyzing || !mediaUrl || calibration.length !== 4}>
              {analyzing ? "Analyzing video…" : "Auto-track ball motion"}
            </button>
            {analyzing && (
              <div className="ar-analysis-progress">
                <div><span style={{ width: `${Math.round(analysisProgress * 100)}%` }} /></div>
                <small>{analysisStatus || "Analyzing…"}</small>
              </div>
            )}
            {trackingConfidence !== null && (
              <div className={`ar-confidence-box ${trackingConfidence >= 0.7 ? "strong" : "review"}`}>
                <span>Ball-track confidence</span><strong>{Math.round(trackingConfidence * 100)}%</strong>
                <p>{trackingConfidence >= 0.7 ? "Strong assisted track. Still verify the four gold key points." : "Limited confidence. Carefully correct the four gold key points or switch to manual marking."}</p>
              </div>
            )}
            {trackingMode === "assisted" && <button type="button" className="secondary-button wide" onClick={resetPathOnly}>Switch to manual path</button>}
          </section>

          <section className="glass-panel ar-setup-card">
            <div className="panel-heading"><div><small>CAPTURE SETUP</small><h2>Analysis details</h2></div></div>
            <label className="field"><span>Attach to session</span><select value={sessionId ?? ""} onChange={(event) => setSessionId(event.target.value ? Number(event.target.value) : null)}><option value="">No session</option>{sessions.map((session) => <option key={session.id} value={session.id}>{session.center_name} • Lane {session.lane_number || "—"} • {session.status}</option>)}</select></label>
            <label className="field"><span>Notes</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Camera position, lane, delivery, or tracking notes" /></label>
            <div className="ar-progress-list">
              <div className={calibration.length === 4 ? "done" : "active"}><span>1</span><p><strong>Calibrate lane</strong><small>{calibration.length}/4 corners</small></p></div>
              <div className={pathPoints.length === 4 ? "done" : stage === "path" ? "active" : ""}><span>2</span><p><strong>Track ball path</strong><small>{trackingMode === "assisted" ? `${autoTrackPoints.length} assisted samples` : `${pathPoints.length}/4 manual points`}</small></p></div>
              <div className={pathPoints.length === 4 ? "active" : ""}><span>3</span><p><strong>Review and correct</strong><small>Drag gold points before saving</small></p></div>
            </div>
          </section>

          <section className="glass-panel ar-board-results">
            <div className="panel-heading"><div><small>ESTIMATED RESULT</small><h2>Shot telemetry</h2></div></div>
            {detectedEvents.length > 0 && (
              <div className="ar-event-timeline">
                {detectedEvents.map((event) => (
                  <div key={event.label}>
                    <span>{event.label}</span>
                    <strong>{event.timeSec.toFixed(2)}s</strong>
                    <small>{event.board === null ? "Board —" : `Board ${formatBoard(displayBoard(event.board))}`} • {Math.round(event.confidence * 100)}%</small>
                  </div>
                ))}
              </div>
            )}
            <div className="ar-result-grid">
              {pathLabels.map((label) => <div key={label}><small>{label}</small><strong>{formatBoard(displayBoard(derivedBoards[label.toLowerCase()]))}</strong></div>)}
              <div><small>Estimated speed</small><strong className="metric-value">{formatMetric(estimatedSpeedMph, "mph")}</strong></div>
              <div><small>Entry angle</small><strong className="metric-value">{formatMetric(estimatedEntryAngleDeg, "°")}</strong></div>
            </div>
            <p>{handLabel(user?.handedness || "right")} board numbers are shown. Board, speed, and angle values are coaching estimates. Review the path before using them as official telemetry.</p>
            <button type="button" className="primary-button wide" disabled={busy || calibration.length !== 4 || pathPoints.length !== 4} onClick={saveCapture}>{busy ? "Saving analysis…" : "Save AR analysis"}</button>
          </section>

          <section className="glass-panel ar-safety-card">
            <Icon name="spark" width={22} />
            <div><strong>Assisted detection boundary</strong><p>This is browser-based motion analysis, not a trained ball-identification model. Reflections, people, unstable cameras, and low light can reduce confidence. Every result remains editable before saving.</p></div>
          </section>
        </aside>
      </div>

      <section className="glass-panel ar-history">
        <div className="panel-heading"><div><small>SAVED ANALYSES</small><h2>Recent AR captures</h2></div></div>
        <div className="ar-history-grid">
          {captures.slice(0, 8).map((capture) => (
            <article key={capture.id}>
              <div><span>#{capture.id}</span><small>{capture.tracking_mode || "manual"} • {new Date(capture.created_at).toLocaleString()}</small></div>
              <strong>Laydown {formatBoard(displayBoard(capture.derived_boards.laydown))} → Target {formatBoard(displayBoard(capture.derived_boards.target))}</strong>
              <p>Breakpoint {formatBoard(displayBoard(capture.derived_boards.breakpoint))} • Pocket {formatBoard(displayBoard(capture.derived_boards.pocket))}</p>
              {(capture.estimated_speed_mph !== null || capture.tracking_confidence !== null) && <p>{capture.estimated_speed_mph !== null ? `${capture.estimated_speed_mph.toFixed(1)} mph` : "No speed"} • {capture.tracking_confidence !== null ? `${Math.round(capture.tracking_confidence * 100)}% confidence` : "Manual"}</p>}
              <button type="button" onClick={() => void deleteCapture(capture.id)}>Delete</button>
            </article>
          ))}
          {!captures.length && <p className="strip-empty">No saved AR analyses yet.</p>}
        </div>
      </section>

      <section className="ar-roadmap">
        <article className="glass-panel"><span>Phase 1 • Included</span><h3>Guided camera tracking</h3><p>Video capture, lane calibration, manual path marking, board estimates, and saved review records.</p></article>
        <article className="glass-panel"><span>Phase 2 • Included beta</span><h3>Computer-vision assist</h3><p>Lane-corner suggestions, local frame-difference tracking, confidence scoring, speed and entry-angle estimates, and draggable correction.</p></article>
        <article className="glass-panel"><span>Next phase</span><h3>Trained ball detector</h3><p>A dedicated model for balls, reflections, occlusion, and multiple camera placements, followed by a native iOS/Android AR companion.</p></article>
      </section>
    </div>
  );
}
