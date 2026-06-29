"use client";

import { useEffect, useState } from "react";
import type { Ball, Shot, ShotInput } from "@/lib/types";

const initial: ShotInput = {
  ball_id: null,
  game_number: 1,
  frame_number: 1,
  feet_board: 25,
  laydown_board: 22,
  target_board: 12,
  breakpoint_board: 8,
  pocket_board: 17.5,
  speed_mph: 16.5,
  rev_rate: null,
  axis_rotation: null,
  axis_tilt: null,
  pinfall: 10,
  leave_code: null,
  delivery_quality: "good",
  notes: null,
};

function NumberInput({ label, value, min, max, step = 1, onChange }: { label: string; value: number | null; min: number; max: number; step?: number; onChange: (value: number | null) => void }) {
  return <label className="field"><span>{label}</span><input type="number" value={value ?? ""} min={min} max={max} step={step} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}/></label>;
}

export function ShotForm({ balls, lastShot, handedness, busy, onSubmit }: { balls: Ball[]; lastShot: Shot | null; handedness: "right" | "left"; busy: boolean; onSubmit: (payload: ShotInput) => Promise<void> }) {
  const [form, setForm] = useState<ShotInput>(initial);
  const [advanced, setAdvanced] = useState(false);

  useEffect(() => {
    const primary = balls.find((ball) => ball.is_primary) || balls[0];
    setForm((current) => ({ ...current, ball_id: current.ball_id || primary?.id || null, pocket_board: lastShot ? current.pocket_board : (handedness === "right" ? 17.5 : 22.5) }));
  }, [balls, handedness, lastShot]);

  useEffect(() => {
    if (!lastShot) return;
    setForm((current) => ({
      ...current,
      ball_id: lastShot.ball_id,
      game_number: lastShot.game_number,
      frame_number: Math.min(12, (lastShot.frame_number || 0) + 1),
      feet_board: lastShot.feet_board + (lastShot.recommendation?.feet_delta || 0),
      laydown_board: lastShot.laydown_board + (lastShot.recommendation?.feet_delta || 0),
      target_board: lastShot.target_board + (lastShot.recommendation?.target_delta || 0),
      breakpoint_board: lastShot.breakpoint_board,
      pocket_board: handedness === "right" ? 17.5 : 22.5,
      speed_mph: lastShot.speed_mph,
      pinfall: 10,
      delivery_quality: "good",
      leave_code: null,
      notes: null,
    }));
  }, [lastShot, handedness]);

  function patch<K extends keyof ShotInput>(key: K, value: ShotInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    await onSubmit(form);
  }

  return (
    <form className="shot-form" onSubmit={submit}>
      <div className="form-section-title"><div><small>Shot telemetry</small><h3>Log the result</h3></div><button type="button" className="text-button" onClick={() => setAdvanced((value) => !value)}>{advanced ? "Simple fields" : "Advanced fields"}</button></div>
      <div className="form-grid compact">
        <label className="field span-2"><span>Ball</span><select value={form.ball_id ?? ""} onChange={(e) => patch("ball_id", e.target.value ? Number(e.target.value) : null)}><option value="">Unspecified</option>{balls.map((ball) => <option key={ball.id} value={ball.id}>{ball.manufacturer} {ball.model}</option>)}</select></label>
        <NumberInput label="Game" value={form.game_number} min={1} max={20} onChange={(v) => patch("game_number", v || 1)}/>
        <NumberInput label="Frame" value={form.frame_number} min={1} max={12} onChange={(v) => patch("frame_number", v)}/>
        <NumberInput label="Feet board" value={form.feet_board} min={1} max={39} step={0.5} onChange={(v) => patch("feet_board", v || 1)}/>
        <NumberInput label="Laydown" value={form.laydown_board} min={1} max={39} step={0.5} onChange={(v) => patch("laydown_board", v || 1)}/>
        <NumberInput label="Arrow target" value={form.target_board} min={1} max={39} step={0.5} onChange={(v) => patch("target_board", v || 1)}/>
        <NumberInput label="Breakpoint" value={form.breakpoint_board} min={1} max={39} step={0.5} onChange={(v) => patch("breakpoint_board", v || 1)}/>
        <NumberInput label="Pocket board" value={form.pocket_board} min={1} max={39} step={0.25} onChange={(v) => patch("pocket_board", v || 1)}/>
        <NumberInput label="Ball speed" value={form.speed_mph} min={5} max={30} step={0.1} onChange={(v) => patch("speed_mph", v)}/>
        <NumberInput label="Pinfall" value={form.pinfall} min={0} max={10} onChange={(v) => patch("pinfall", v ?? 0)}/>
        <label className="field"><span>Delivery</span><select value={form.delivery_quality} onChange={(e) => patch("delivery_quality", e.target.value)}><option value="good">Good delivery</option><option value="unknown">Unknown</option><option value="missed_left">Missed target left</option><option value="missed_right">Missed target right</option><option value="pulled">Pulled shot</option><option value="slow">Lost speed</option><option value="fast">Extra speed</option></select></label>
      </div>
      {advanced && <div className="form-grid compact advanced-grid">
        <NumberInput label="Rev rate" value={form.rev_rate} min={0} max={800} onChange={(v) => patch("rev_rate", v)}/>
        <NumberInput label="Axis rotation" value={form.axis_rotation} min={0} max={180} step={1} onChange={(v) => patch("axis_rotation", v)}/>
        <NumberInput label="Axis tilt" value={form.axis_tilt} min={0} max={90} step={1} onChange={(v) => patch("axis_tilt", v)}/>
        <label className="field"><span>Leave</span><input value={form.leave_code ?? ""} placeholder="e.g. 10 pin" onChange={(e) => patch("leave_code", e.target.value || null)}/></label>
        <label className="field span-4"><span>Notes</span><input value={form.notes ?? ""} placeholder="What did you see?" onChange={(e) => patch("notes", e.target.value || null)}/></label>
      </div>}
      <button className="primary-button wide" type="submit" disabled={busy}>{busy ? "Analyzing shot…" : "Log shot & calculate next move"}</button>
    </form>
  );
}
