"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { getQueuedShots, queueShot, removeQueuedShot } from "@/lib/offline";
import type { Ball, LaneState, SessionDetail, Shot, ShotInput } from "@/lib/types";
import { formatBoard, handLabel, toDisplayBoard, toPhysicalBoard } from "@/lib/boards";
import { LaneCanvas } from "@/components/LaneCanvas";
import { ShotForm } from "@/components/ShotForm";
import { RecommendationCard } from "@/components/RecommendationCard";
import { BallChangeOverlay } from "@/components/BallChangeOverlay";
import { parseLeave, stringifyLeave } from "@/components/PinLeaveSelector";
import { Icon } from "@/components/Icons";
import { useAuth } from "@/components/AuthProvider";

type Workflow = "first" | "spare" | "second";
const ALL_PINS = [1,2,3,4,5,6,7,8,9,10];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function pickSpareBall(balls: Ball[]) {
  return balls.find((ball) => /plastic|polyester/i.test(ball.coverstock))
    || balls.find((ball) => /urethane/i.test(ball.coverstock))
    || balls[0]
    || null;
}

function availablePinsFor(workflow: Workflow, lastShot: Shot | null) {
  if (workflow === "first" || !lastShot) return ALL_PINS;
  const leave = parseLeave(lastShot.leave_code, lastShot.pinfall);
  return leave.length ? leave : ALL_PINS;
}

function createDraft(
  handedness: "right" | "left",
  balls: Ball[],
  lastShot: Shot | null,
  workflow: Workflow,
): ShotInput {
  const defaultBall = balls.find((ball) => ball.is_primary) || balls[0] || null;
  const spareBall = pickSpareBall(balls);
  const availablePins = availablePinsFor(workflow, lastShot);
  const physical = (displayBoard: number) => toPhysicalBoard(displayBoard, handedness);

  if (!lastShot) {
    return {
      ball_id: (workflow === "spare" ? spareBall : defaultBall)?.id ?? null,
      game_number: 1,
      frame_number: 1,
      feet_board: physical(25),
      feet_depth_ft: 11.5,
      laydown_board: physical(22),
      target_board: physical(12),
      breakpoint_board: physical(8),
      pocket_board: physical(17.5),
      speed_mph: workflow === "spare" ? 17.5 : 16.5,
      rev_rate: null,
      axis_rotation: null,
      axis_tilt: null,
      pinfall: 0,
      leave_code: stringifyLeave(availablePins),
      delivery_quality: "good",
      notes: workflow === "spare" ? "Spare attempt" : null,
    };
  }

  const sourceHand = lastShot.handedness || "right";
  const mirrorForCurrentHand = sourceHand !== handedness;
  const sourceBoard = (board: number) => mirrorForCurrentHand ? 40 - board : board;
  const recommendationSign = mirrorForCurrentHand ? -1 : 1;
  const applyRecommendation = workflow === "first";
  const feetDelta = applyRecommendation ? (lastShot.recommendation?.feet_delta || 0) * recommendationSign : 0;
  const targetDelta = applyRecommendation ? (lastShot.recommendation?.target_delta || 0) * recommendationSign : 0;
  const depthDelta = applyRecommendation ? (lastShot.recommendation?.feet_depth_delta_ft || 0) : 0;

  return {
    ball_id: workflow === "spare"
      ? (spareBall?.id ?? lastShot.ball_id ?? defaultBall?.id ?? null)
      : (lastShot.ball_id ?? defaultBall?.id ?? null),
    game_number: lastShot.game_number,
    frame_number: workflow === "first" ? Math.min(12, (lastShot.frame_number || 0) + 1) : lastShot.frame_number,
    feet_board: clamp(sourceBoard(lastShot.feet_board) + feetDelta, 1, 39),
    feet_depth_ft: clamp((lastShot.feet_depth_ft || 11.5) + depthDelta, 0.5, 15),
    laydown_board: clamp(sourceBoard(lastShot.laydown_board) + feetDelta, 1, 39),
    target_board: clamp(sourceBoard(lastShot.target_board) + targetDelta, 1, 39),
    breakpoint_board: sourceBoard(lastShot.breakpoint_board),
    pocket_board: physical(17.5),
    speed_mph: workflow === "spare" ? Math.max(lastShot.speed_mph || 16.5, 17) : (lastShot.speed_mph || 16.5),
    rev_rate: lastShot.rev_rate,
    axis_rotation: lastShot.axis_rotation,
    axis_tilt: lastShot.axis_tilt,
    pinfall: 0,
    leave_code: stringifyLeave(availablePins),
    delivery_quality: "good",
    notes: workflow === "spare" ? "Spare attempt" : workflow === "second" ? "Second shot" : null,
  };
}

function nextWorkflow(previous: Workflow, shot: Shot): Workflow {
  if (previous === "first" && shot.pinfall < 10) return "spare";
  return "first";
}

export default function LivePage() {
  const { user } = useAuth();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [balls, setBalls] = useState<Ball[]>([]);
  const [laneState, setLaneState] = useState<LaneState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [queued, setQueued] = useState(0);
  const [workflow, setWorkflow] = useState<Workflow>("first");
  const [draft, setDraft] = useState<ShotInput | null>(null);
  const [resultShot, setResultShot] = useState<Shot | null>(null);
  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHandednessRef = useRef<"right" | "left" | null>(null);
  const [createForm, setCreateForm] = useState({
    center_name: "Practice Center",
    lane_number: "",
    oil_pattern_name: "Typical House Shot",
    oil_length_ft: 41,
  });

  const latest = useMemo(() => session?.shots?.[session.shots.length - 1] ?? null, [session]);
  const availablePins = useMemo(() => availablePinsFor(workflow, latest), [workflow, latest]);

  const load = useCallback(async () => {
    try {
      const [dashboardBalls, sessions] = await Promise.all([
        apiFetch<Ball[]>("/api/balls"),
        apiFetch<Array<{ id: number; status: string }>>("/api/sessions"),
      ]);
      setBalls(dashboardBalls);
      const active = sessions.find((item) => item.status === "active");
      if (!active) {
        setSession(null);
        setLaneState(null);
        setDraft(null);
        return;
      }
      const detail = await apiFetch<SessionDetail>(`/api/sessions/${active.id}`);
      setSession(detail);
      setLaneState(await apiFetch<LaneState>(`/api/sessions/${active.id}/lane-state`));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load session");
    } finally {
      setQueued(getQueuedShots().length);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!user || !session || draft) return;
    setDraft(createDraft(user.handedness, balls, latest, workflow));
  }, [user, session, balls, latest, workflow, draft]);

  useEffect(() => {
    if (!user || !session) return;
    if (lastHandednessRef.current && lastHandednessRef.current !== user.handedness) {
      setDraft(createDraft(user.handedness, balls, latest, workflow));
      setMessage(`Lane setup mirrored for your ${handLabel(user.handedness).toLowerCase()} profile.`);
    }
    lastHandednessRef.current = user.handedness;
  }, [user?.handedness, session?.id, balls, latest, workflow]);

  useEffect(() => () => {
    if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
  }, []);

  const syncQueue = useCallback(async () => {
    if (!navigator.onLine) return;
    for (const item of getQueuedShots()) {
      try {
        await apiFetch<Shot>(`/api/sessions/${item.sessionId}/shots`, {
          method: "POST",
          body: JSON.stringify(item.payload),
        });
        removeQueuedShot(item.id);
      } catch {
        break;
      }
    }
    setQueued(getQueuedShots().length);
    if (session) void load();
  }, [load, session]);

  useEffect(() => {
    window.addEventListener("online", syncQueue);
    void syncQueue();
    return () => window.removeEventListener("online", syncQueue);
  }, [syncQueue]);

  function switchWorkflow(next: Workflow) {
    if (!user || resultShot) return;
    setWorkflow(next);
    setDraft(createDraft(user.handedness, balls, latest, next));
  }

  async function createSession(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const created = await apiFetch<SessionDetail>("/api/sessions", {
        method: "POST",
        body: JSON.stringify({ ...createForm, lane_number: createForm.lane_number || null }),
      });
      const detail = await apiFetch<SessionDetail>(`/api/sessions/${created.id}`);
      setSession(detail);
      setLaneState(await apiFetch<LaneState>(`/api/sessions/${created.id}/lane-state`));
      setWorkflow("first");
      if (user) setDraft(createDraft(user.handedness, balls, null, "first"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to start session");
    } finally {
      setBusy(false);
    }
  }

  async function submitShot(payload: ShotInput) {
    if (!session || resultShot) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const shot = await apiFetch<Shot>(`/api/sessions/${session.id}/shots`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setSession({ ...session, shots: [...session.shots, shot], shot_count: session.shots.length + 1 });
      setLaneState(await apiFetch<LaneState>(`/api/sessions/${session.id}/lane-state`));
      setResultShot(shot);
      const next = nextWorkflow(workflow, shot);
      setMessage(next === "spare"
        ? "First ball logged. The remaining pins are loaded into Spare mode."
        : "Shot logged and the next-shot setup is ready.");

      if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
      resultTimerRef.current = setTimeout(() => {
        setResultShot(null);
        setWorkflow(next);
        if (user) setDraft(createDraft(user.handedness, balls, shot, next));
      }, 950);
    } catch (caught) {
      if (!navigator.onLine || caught instanceof TypeError) {
        queueShot(session.id, payload);
        setQueued(getQueuedShots().length);
        setMessage("No connection. The shot is safely queued on this device.");
      } else {
        setError(caught instanceof Error ? caught.message : "Unable to log shot");
      }
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    if (!session?.shots.length || resultShot) return;
    const last = session.shots[session.shots.length - 1];
    if (!confirm(`Remove shot #${last.sequence_number}?`)) return;
    await apiFetch<void>(`/api/shots/${last.id}`, { method: "DELETE" });
    const updated = {
      ...session,
      shots: session.shots.slice(0, -1),
      shot_count: Math.max(0, session.shot_count - 1),
    };
    const newLatest = updated.shots[updated.shots.length - 1] ?? null;
    setSession(updated);
    setLaneState(await apiFetch<LaneState>(`/api/sessions/${session.id}/lane-state`));
    setWorkflow("first");
    if (user) setDraft(createDraft(user.handedness, balls, newLatest, "first"));
  }

  async function finish() {
    if (!session || resultShot || !confirm("Finish this session? You will not be able to add more shots.")) return;
    await apiFetch(`/api/sessions/${session.id}/finish`, { method: "POST" });
    setSession(null);
    setLaneState(null);
    setDraft(null);
    setWorkflow("first");
    setMessage("Session completed. It is now available in analytics.");
  }

  if (!session) {
    return (
      <div className="page-content">
        <div className="page-heading">
          <div><span className="eyebrow small">Live lane</span><h1>Start a bowling session</h1><p>Choose the lane condition before logging the first shot.</p></div>
        </div>
        {error && <div className="error-banner">{error}</div>}
        {message && <div className="success-banner">{message}</div>}
        <form className="glass-panel create-session-form" onSubmit={createSession}>
          <div className="create-session-art"><span className="lane-orbit large"><span /></span><h2>New lane session</h2><p>StrikePath will track each controlled result and estimate how your line is transitioning.</p></div>
          <div className="form-grid">
            <label className="field span-2"><span>Bowling center</span><input required value={createForm.center_name} onChange={(event) => setCreateForm({ ...createForm, center_name: event.target.value })} /></label>
            <label className="field"><span>Lane</span><input value={createForm.lane_number} onChange={(event) => setCreateForm({ ...createForm, lane_number: event.target.value })} placeholder="18" /></label>
            <label className="field span-2"><span>Oil pattern</span><input required value={createForm.oil_pattern_name} onChange={(event) => setCreateForm({ ...createForm, oil_pattern_name: event.target.value })} /></label>
            <label className="field"><span>Oil length (ft)</span><input type="number" min={20} max={60} step={0.5} value={createForm.oil_length_ft} onChange={(event) => setCreateForm({ ...createForm, oil_length_ft: Number(event.target.value) })} /></label>
            <button className="primary-button span-3" disabled={busy}>{busy ? "Starting…" : "Start live session"}</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="page-content live-page">
      <div className="page-heading live-heading">
        <div>
          <span className="eyebrow small"><i className="live-dot" />Live lane • {session.center_name}</span>
          <h1>Lane {session.lane_number || "—"}</h1>
          <p>{session.oil_pattern_name} • {session.oil_length_ft} ft • {session.shots.length} shots</p>
        </div>
        <div className="heading-actions">
          {queued > 0 && <button className="queued-pill" onClick={() => void syncQueue()}><Icon name="wifi" width={16} />{queued} queued</button>}
          <button className="secondary-button small" onClick={undo} disabled={!session.shots.length || !!resultShot}>Undo last</button>
          <button className="danger-button small" onClick={finish} disabled={!!resultShot}>Finish session</button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {message && <div className="success-banner">{message}</div>}

      <section className="workflow-panel glass-panel">
        <div>
          <small>Shot workflow</small>
          <h2>{workflow === "first" ? "First-ball setup" : workflow === "spare" ? "Spare conversion" : "Second-ball practice"}</h2>
          <p>{handLabel(user?.handedness || "right")} board numbering is active. First-ball shots automatically advance to Spare mode whenever pins remain.</p>
        </div>
        <div className="workflow-tabs" role="tablist" aria-label="Shot workflow">
          <button type="button" className={workflow === "first" ? "active" : ""} onClick={() => switchWorkflow("first")}>First ball</button>
          <button type="button" className={workflow === "spare" ? "active" : ""} onClick={() => switchWorkflow("spare")}>Spare mode</button>
          <button type="button" className={workflow === "second" ? "active" : ""} onClick={() => switchWorkflow("second")}>Second ball</button>
        </div>
      </section>

      <div className="live-grid">
        <section className="glass-panel lane-panel">
          <div className="panel-heading">
            <div><small>Dynamic lane view</small><h2>Interactive line editor</h2></div>
            <span className="lane-mode">Stable edit mode</span>
          </div>
          <LaneCanvas
            shots={session.shots}
            laneState={laneState}
            editableShot={draft ?? undefined}
            onEditShot={(patch) => setDraft((current) => current ? ({ ...current, ...patch }) : current)}
            recommendation={latest?.recommendation ?? null}
            resultShot={resultShot}
            handedness={user?.handedness || "right"}
          />
          <p className="model-disclaimer">{laneState?.description || "Log a shot to generate the estimated lane model."}</p>
        </section>

        <aside className="live-controls">
          <RecommendationCard recommendation={latest?.recommendation || null} />
          <BallChangeOverlay latest={latest} balls={balls} />
          <div className="glass-panel shot-form-panel">
            {draft && (
              <ShotForm
                balls={balls}
                form={draft}
                busy={busy || !!resultShot}
                onChange={(patch) => setDraft((current) => current ? ({ ...current, ...patch }) : current)}
                onSubmit={submitShot}
                workflow={workflow}
                availablePins={availablePins}
                handedness={user?.handedness || "right"}
              />
            )}
          </div>
        </aside>
      </div>

      <section className="glass-panel shot-strip">
        <div className="panel-heading"><div><small>Shot history</small><h2>Latest deliveries</h2></div></div>
        <div className="shot-cards">
          {session.shots.slice(-8).reverse().map((shot) => (
            <article key={shot.id}>
              <span className={shot.pinfall === 10 ? "strike" : ""}>#{shot.sequence_number}</span>
              <div><strong>{shot.pinfall === 10 ? "Strike" : `${shot.pinfall} pins`}</strong><small>Frame {shot.frame_number} • Pocket {formatBoard(toDisplayBoard(shot.pocket_board, user?.handedness || "right"))} • {shot.speed_mph ? `${shot.speed_mph} mph` : "No speed"}</small></div>
              <em>{shot.delivery_quality.replaceAll("_", " ")}</em>
            </article>
          ))}
          {!session.shots.length && <p className="strip-empty">Your logged shots will appear here.</p>}
        </div>
      </section>
    </div>
  );
}
