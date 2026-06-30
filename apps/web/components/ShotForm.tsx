"use client";

import { useEffect, useState } from "react";
import type { Ball, Handedness, ShotInput } from "@/lib/types";
import { handLabel, toDisplayBoard, toPhysicalBoard } from "@/lib/boards";
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
  workflow,
  availablePins,
  handedness,
}: {
  balls: Ball[];
  form: ShotInput;
  busy: boolean;
  onChange: (patch: Partial<ShotInput>) => void;
  onSubmit: (payload: ShotInput) => Promise<void>;
  workflow: "first" | "spare" | "second";
  availablePins: number[];
  handedness: Handedness;
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
        <strong>{workflow === "first" ? "First-ball mode" : workflow === "spare" ? "Spare mode" : "Second-ball mode"}</strong> — {handLabel(handedness)} board numbering is active. Drag markers on the lane or fine-tune the same displayed numbers here.
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
        <NumberInput label={`Feet board (${handedness === "left" ? "LH" : "RH"})`} value={toDisplayBoard(form.feet_board, handedness)} min={1} max={39} step={0.5} hint="Starting position on the approach, counted from your bowling-hand gutter." onChange={(v) => onChange({ feet_board: toPhysicalBoard(v || 1, handedness) })} />
        <NumberInput label="Feet distance behind foul line" value={form.feet_depth_ft} min={0.5} max={15} step={0.5} hint="Move this forward or backward on the approach. Larger numbers are farther from the foul line." onChange={(v) => onChange({ feet_depth_ft: v || 0.5 })} />
        <NumberInput label={`Laydown (${handedness === "left" ? "LH" : "RH"})`} value={toDisplayBoard(form.laydown_board, handedness)} min={1} max={39} step={0.5} hint="Where the ball first contacts the lane." onChange={(v) => onChange({ laydown_board: toPhysicalBoard(v || 1, handedness) })} />
        <NumberInput label={`Arrow target (${handedness === "left" ? "LH" : "RH"})`} value={toDisplayBoard(form.target_board, handedness)} min={1} max={39} step={0.5} hint="Board crossed near the arrow zone." onChange={(v) => onChange({ target_board: toPhysicalBoard(v || 1, handedness) })} />
        <NumberInput label={`Breakpoint (${handedness === "left" ? "LH" : "RH"})`} value={toDisplayBoard(form.breakpoint_board, handedness)} min={1} max={39} step={0.5} hint="Estimated hook point downlane." onChange={(v) => onChange({ breakpoint_board: toPhysicalBoard(v || 1, handedness) })} />
        <NumberInput label={`Pocket board (${handedness === "left" ? "LH" : "RH"})`} value={toDisplayBoard(form.pocket_board, handedness)} min={1} max={39} step={0.25} hint="Displayed from your side; stored in a neutral physical coordinate system." onChange={(v) => onChange({ pocket_board: toPhysicalBoard(v || 1, handedness) })} />
        <NumberInput label="Ball speed" value={form.speed_mph} min={5} max={30} step={0.1} hint="MPH at release or lane monitor." allowEmpty onChange={(v) => onChange({ speed_mph: v })} />
        <label className="field">
          <span>Pinfall</span>
          <input className="readonly-number" value={form.pinfall} readOnly aria-readonly="true" />
          <small className="field-hint">Calculated from the pin leave selector.</small>
        </label>
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
        availablePins={availablePins}
        onChange={(pins) => onChange({ leave_code: stringifyLeave(pins), pinfall: Math.max(0, availablePins.length - pins.length) })}
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
        {busy ? "Analyzing shot…" : workflow === "spare" ? "Log spare attempt" : workflow === "second" ? "Log second shot" : "Log shot & calculate next move"}
      </button>
    </form>
  );
}
