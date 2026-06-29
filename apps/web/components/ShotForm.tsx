"use client";

import { useEffect, useState } from "react";
import type { Ball, ShotInput } from "@/lib/types";
import { PinLeaveSelector, parseLeave, stringifyLeave } from "./PinLeaveSelector";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function NumberInput({
  label,
  value,
  min,
  max,
  step = 1,
  hint,
  allowEmpty = false,
  onChange,
}: {
  label: string;
  value: number | null;
  min: number;
  max: number;
  step?: number;
  hint?: string;
  allowEmpty?: boolean;
  onChange: (value: number | null) => void;
}) {
  const [text, setText] = useState<string>(value === null ? "" : String(value));

  useEffect(() => {
    setText(value === null ? "" : String(value));
  }, [value]);

  function commit(raw: string, finalize: boolean) {
    if (raw === "") {
      if (allowEmpty) {
        onChange(null);
        if (finalize) setText("");
      } else {
        const fallback = typeof value === "number" ? value : min;
        const normalized = clamp(fallback, min, max);
        onChange(normalized);
        if (finalize) setText(String(normalized));
      }
      return;
    }

    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      if (finalize) setText(value === null ? "" : String(value));
      return;
    }

    const normalized = clamp(parsed, min, max);
    onChange(normalized);
    if (finalize) setText(String(normalized));
  }

  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        inputMode="decimal"
        value={text}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          setText(e.target.value);
          commit(e.target.value, false);
        }}
        onBlur={(e) => commit(e.target.value, true)}
      />
      {hint && <small className="field-hint">{hint}</small>}
    </label>
  );
}

export function ShotForm({
  balls,
  form,
  busy,
  onChange,
  onSubmit,
}: {
  balls: Ball[];
  form: ShotInput;
  busy: boolean;
  onChange: (patch: Partial<ShotInput>) => void;
  onSubmit: (payload: ShotInput) => Promise<void>;
}) {
  const [advanced, setAdvanced] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    await onSubmit({
      ...form,
      game_number: Math.round(form.game_number),
      frame_number: form.frame_number === null ? null : Math.round(form.frame_number),
      pinfall: Math.round(form.pinfall),
    });
  }

  const standingPins = parseLeave(form.leave_code, form.pinfall);

  return (
    <form className="shot-form" onSubmit={submit}>
      <div className="form-section-title">
        <div>
          <small>Shot telemetry</small>
          <h3>Log the result</h3>
        </div>
        <button type="button" className="text-button" onClick={() => setAdvanced((value) => !value)}>
          {advanced ? "Simple fields" : "Advanced fields"}
        </button>
      </div>

      <div className="shot-form-tip">
        Drag the markers directly on the lane, or fine-tune exact board numbers here. The pin diagram below will update pinfall and leave automatically.
      </div>

      <div className="form-grid compact">
        <label className="field span-2">
          <span>Ball</span>
          <select value={form.ball_id ?? ""} onChange={(e) => onChange({ ball_id: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Unspecified</option>
            {balls.map((ball) => (
              <option key={ball.id} value={ball.id}>
                {ball.manufacturer} {ball.model}
              </option>
            ))}
          </select>
        </label>
        <NumberInput label="Game" value={form.game_number} min={1} max={20} onChange={(v) => onChange({ game_number: v || 1 })} />
        <NumberInput label="Frame" value={form.frame_number} min={1} max={12} onChange={(v) => onChange({ frame_number: v })} />
        <NumberInput label="Feet board" value={form.feet_board} min={1} max={39} step={0.5} hint="Starting position on the approach." onChange={(v) => onChange({ feet_board: v || 1 })} />
        <NumberInput label="Laydown" value={form.laydown_board} min={1} max={39} step={0.5} hint="Where the ball first contacts the lane." onChange={(v) => onChange({ laydown_board: v || 1 })} />
        <NumberInput label="Arrow target" value={form.target_board} min={1} max={39} step={0.5} hint="Board crossed at 15 feet." onChange={(v) => onChange({ target_board: v || 1 })} />
        <NumberInput label="Breakpoint" value={form.breakpoint_board} min={1} max={39} step={0.5} hint="Estimated hook point downlane." onChange={(v) => onChange({ breakpoint_board: v || 1 })} />
        <NumberInput label="Pocket board" value={form.pocket_board} min={1} max={39} step={0.25} hint="Desired entry line through the pin deck." onChange={(v) => onChange({ pocket_board: v || 1 })} />
        <NumberInput label="Ball speed" value={form.speed_mph} min={5} max={30} step={0.1} hint="MPH at release or lane monitor." allowEmpty onChange={(v) => onChange({ speed_mph: v })} />
        <NumberInput label="Pinfall" value={form.pinfall} min={0} max={10} hint="Auto-updates from the pin leave selector." onChange={(v) => onChange({ pinfall: v ?? 0, leave_code: v === 10 ? null : form.leave_code })} />
        <label className="field">
          <span>Delivery</span>
          <select value={form.delivery_quality} onChange={(e) => onChange({ delivery_quality: e.target.value })}>
            <option value="good">Good delivery</option>
            <option value="unknown">Unknown</option>
            <option value="missed_left">Missed target left</option>
            <option value="missed_right">Missed target right</option>
            <option value="pulled">Pulled shot</option>
            <option value="slow">Lost speed</option>
            <option value="fast">Extra speed</option>
          </select>
        </label>
      </div>

      <PinLeaveSelector
        standingPins={standingPins}
        onChange={(pins) => onChange({ leave_code: stringifyLeave(pins), pinfall: 10 - pins.length })}
      />

      {advanced && (
        <div className="form-grid compact advanced-grid">
          <NumberInput label="Rev rate" value={form.rev_rate} min={0} max={800} allowEmpty onChange={(v) => onChange({ rev_rate: v })} />
          <NumberInput label="Axis rotation" value={form.axis_rotation} min={0} max={180} step={1} allowEmpty onChange={(v) => onChange({ axis_rotation: v })} />
          <NumberInput label="Axis tilt" value={form.axis_tilt} min={0} max={90} step={1} allowEmpty onChange={(v) => onChange({ axis_tilt: v })} />
          <label className="field">
            <span>Leave code</span>
            <input value={form.leave_code ?? ""} placeholder="e.g. 10 or 7-10" onChange={(e) => onChange({ leave_code: e.target.value || null })} />
          </label>
          <label className="field span-4">
            <span>Notes</span>
            <input value={form.notes ?? ""} placeholder="What did you see?" onChange={(e) => onChange({ notes: e.target.value || null })} />
          </label>
        </div>
      )}
      <button className="primary-button wide" type="submit" disabled={busy}>
        {busy ? "Analyzing shot…" : "Log shot & calculate next move"}
      </button>
    </form>
  );
}
