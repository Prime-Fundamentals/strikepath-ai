"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { getQueuedShots, queueShot, removeQueuedShot } from "@/lib/offline";
import type { Ball, LaneState, SessionDetail, Shot, ShotInput } from "@/lib/types";
import { LaneCanvas } from "@/components/LaneCanvas";
import { ShotForm } from "@/components/ShotForm";
import { RecommendationCard } from "@/components/RecommendationCard";
import { Icon } from "@/components/Icons";
import { useAuth } from "@/components/AuthProvider";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function createDraft(handedness: "right" | "left", balls: Ball[], lastShot: Shot | null): ShotInput {
  const defaultBall = balls.find((ball) => ball.is_primary) || balls[0] || null;

  if (!lastShot) {
    return {
      ball_id: defaultBall?.id ?? null,
      game_number: 1,
      frame_number: 1,
      feet_board: handedness === "right" ? 25 : 15,
      laydown_board: handedness === "right" ? 22 : 18,
      target_board: handedness === "right" ? 12 : 27,
      breakpoint_board: handedness === "right" ? 8 : 31,
      pocket_board: handedness === "right" ? 17.5 : 22.5,
      speed_mph: 16.5,
      rev_rate: null,
      axis_rotation: null,
      axis_tilt: null,
      pinfall: 10,
      leave_code: null,
      delivery_quality: "good",
      notes: null,
    };
  }

  return {
    ball_id: lastShot.ball_id ?? defaultBall?.id ?? null,
    game_number: lastShot.game_number,
    frame_number: Math.min(12, (lastShot.frame_number || 0) + 1),
    feet_board: clamp(lastShot.feet_board + (lastShot.recommendation?.feet_delta || 0), 1, 39),
    laydown_board: clamp(lastShot.laydown_board + (lastShot.recommendation?.feet_delta || 0), 1, 39),
    target_board: clamp(lastShot.target_board + (lastShot.recommendation?.target_delta || 0), 1, 39),
    breakpoint_board: lastShot.breakpoint_board,
    pocket_board: handedness === "right" ? 17.5 : 22.5,
    speed_mph: lastShot.speed_mph,
    rev_rate: lastShot.rev_rate,
    axis_rotation: lastShot.axis_rotation,
    axis_tilt: lastShot.axis_tilt,
    pinfall: 10,
    leave_code: null,
    delivery_quality: "good",
    notes: null,
  };
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
  const [draft, setDraft] = useState<ShotInput | null>(null);
  const [createForm, setCreateForm] = useState({ center_name: "Practice Center", lane_number: "", oil_pattern_name: "Typical House Shot", oil_length_ft: 41 });

  const latest = useMemo(() => (session?.shots?.[session.shots.length - 1] ?? null), [session]);

  const load = useCallback(async () => {
    try {
      const [dashboardBalls, sessions] = await Promise.all([
        apiFetch<Ball[]>("/api/balls"),
        apiFetch<Array<{ id: number; status: string }>>("/api/sessions"),
      ]);
      setBalls(dashboardBalls);
      const active = sessions.find((s) => s.status === "active");
      if (active) {
        const detail = await apiFetch<SessionDetail>(`/api/sessions/${active.id}`);
        setSession(detail);
        setLaneState(await apiFetch<LaneState>(`/api/sessions/${active.id}/lane-state`));
      } else {
        setSession(null);
        setLaneState(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load session");
    }
    setQueued(getQueuedShots().length);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!user) return;
    setDraft(createDraft(user.handedness, balls, latest));
  }, [user, balls, latest?.id]);

  const syncQueue = useCallback(async () => {
    if (!navigator.onLine) return;
    for (const item of getQueuedShots()) {
      try {
        await apiFetch<Shot>(`/api/sessions/${item.sessionId}/shots`, { method: "POST", body: JSON.stringify(item.payload) });
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

  async function createSession(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const created = await apiFetch<SessionDetail>("/api/sessions", { method: "POST", body: JSON.stringify({ ...createForm, lane_number: createForm.lane_number || null }) });
      const detail = await apiFetch<SessionDetail>(`/api/sessions/${created.id}`);
      setSession(detail);
      setLaneState(await apiFetch<LaneState>(`/api/sessions/${created.id}/lane-state`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to start session");
    } finally {
      setBusy(false);
    }
  }

  async function submitShot(payload: ShotInput) {
    if (!session) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const shot = await apiFetch<Shot>(`/api/sessions/${session.id}/shots`, { method: "POST", body: JSON.stringify(payload) });
      const updated = { ...session, shots: [...session.shots, shot], shot_count: session.shots.length + 1 };
      setSession(updated);
      setLaneState(await apiFetch<LaneState>(`/api/sessions/${session.id}/lane-state`));
      setMessage("Shot logged and next move calculated.");
      if (user) setDraft(createDraft(user.handedness, balls, shot));
    } catch (e) {
      if (!navigator.onLine || e instanceof TypeError) {
        queueShot(session.id, payload);
        setQueued(getQueuedShots().length);
        setMessage("No connection. The shot is safely queued on this device.");
      } else {
        setError(e instanceof Error ? e.message : "Unable to log shot");
      }
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    if (!session?.shots.length) return;
    const last = session.shots[session.shots.length - 1];
    if (!confirm(`Remove shot #${last.sequence_number}?`)) return;
    await apiFetch<void>(`/api/shots/${last.id}`, { method: "DELETE" });
    const updatedSession = { ...session, shots: session.shots.slice(0, -1), shot_count: Math.max(0, session.shot_count - 1) };
    setSession(updatedSession);
    setLaneState(await apiFetch<LaneState>(`/api/sessions/${session.id}/lane-state`));
    if (user) {
      const newLatest = updatedSession.shots[updatedSession.shots.length - 1] ?? null;
      setDraft(createDraft(user.handedness, balls, newLatest));
    }
  }

  async function finish() {
    if (!session || !confirm("Finish this session? You will not be able to add more shots.")) return;
    await apiFetch(`/api/sessions/${session.id}/finish`, { method: "POST" });
    setSession(null);
    setLaneState(null);
    setMessage("Session completed. It is now available in analytics.");
  }

  if (!session) {
    return <div className="page-content"><div className="page-heading"><div><span className="eyebrow small">Live lane</span><h1>Start a bowling session</h1><p>Choose the lane condition before logging the first shot.</p></div></div>{error && <div className="error-banner">{error}</div>}{message && <div className="success-banner">{message}</div>}<form className="glass-panel create-session-form" onSubmit={createSession}><div className="create-session-art"><span className="lane-orbit large"><span /></span><h2>New lane session</h2><p>StrikePath will track each controlled result and estimate how your line is transitioning.</p></div><div className="form-grid"><label className="field span-2"><span>Bowling center</span><input required value={createForm.center_name} onChange={e => setCreateForm({ ...createForm, center_name: e.target.value })} /></label><label className="field"><span>Lane</span><input value={createForm.lane_number} onChange={e => setCreateForm({ ...createForm, lane_number: e.target.value })} placeholder="18" /></label><label className="field span-2"><span>Oil pattern</span><input required value={createForm.oil_pattern_name} onChange={e => setCreateForm({ ...createForm, oil_pattern_name: e.target.value })} /></label><label className="field"><span>Oil length (ft)</span><input type="number" min={20} max={60} step={0.5} value={createForm.oil_length_ft} onChange={e => setCreateForm({ ...createForm, oil_length_ft: Number(e.target.value) })} /></label><button className="primary-button span-3" disabled={busy}>{busy ? "Starting…" : "Start live session"}</button></div></form></div>;
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
          <button className="secondary-button small" onClick={undo} disabled={!session.shots.length}>Undo last</button>
          <button className="danger-button small" onClick={finish}>Finish session</button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {message && <div className="success-banner">{message}</div>}

      <div className="live-grid">
        <section className="glass-panel lane-panel">
          <div className="panel-heading">
            <div>
              <small>DYNAMIC LANE VIEW</small>
              <h2>Interactive line editor</h2>
            </div>
            <span className="lane-mode">Drag & edit view</span>
          </div>
          <LaneCanvas
            shots={session.shots}
            laneState={laneState}
            editableShot={draft ?? undefined}
            onEditShot={(patch) => setDraft((current) => current ? ({ ...current, ...patch }) : current)}
            recommendation={latest?.recommendation ?? null}
          />
          <p className="model-disclaimer">{laneState?.description || "Log a shot to generate the estimated lane model."}</p>
        </section>

        <aside className="live-controls">
          <RecommendationCard recommendation={latest?.recommendation || null} />
          <div className="glass-panel">
            {draft && <ShotForm balls={balls} form={draft} busy={busy} onChange={(patch) => setDraft((current) => current ? ({ ...current, ...patch }) : current)} onSubmit={submitShot} />}
          </div>
        </aside>
      </div>

      <section className="glass-panel shot-strip">
        <div className="panel-heading"><div><small>SHOT HISTORY</small><h2>Latest deliveries</h2></div></div>
        <div className="shot-cards">
          {session.shots.slice(-8).reverse().map((shot) => <article key={shot.id}><span className={shot.pinfall === 10 ? "strike" : ""}>#{shot.sequence_number}</span><div><strong>{shot.pinfall === 10 ? "Strike" : `${shot.pinfall} pins`}</strong><small>Pocket {shot.pocket_board} • {shot.speed_mph ? `${shot.speed_mph} mph` : "No speed"}</small></div><em>{shot.delivery_quality.replaceAll("_", " ")}</em></article>)}
          {!session.shots.length && <p className="strip-empty">Your logged shots will appear here.</p>}
        </div>
      </section>
    </div>
  );
}
