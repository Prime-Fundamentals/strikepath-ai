"use client";

import { useEffect, useState } from "react";
import type { Ball, Handedness, ShotInput } from "@/lib/types";
import { formatBoard, handLabel, toDisplayBoard, toPhysicalBoard } from "@/lib/boards";
import { PinLeaveSelector, parseLeave, stringifyLeave } from "./PinLeaveSelector";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function NumberInput({ label, value, min, max, step = 1, hint, allowEmpty = false, onChange }: {
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

  useEffect(() => setText(value === null ? "" : String(value)), [value]);

  function commit(raw: string, finalize: boolean) {
    if (raw === "") {
      if (allowEmpty) {
        onChange(null);
        if (finalize) setText("");
      } else {
        const normalized = clamp(typeof value === "number" ? value : min, min, max);
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
      <input type="number" inputMode="decimal" value={text} min={min} max={max} step={step}
        onChange={(event) => { setText(event.target.value); commit(event.target.value, false); }}
        onBlur={(event) => commit(event.target.value, true)} />
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
  onRequestLineEdit,
}: {
  balls: Ball[];
  form: ShotInput;
  busy: boolean;
  onChange: (patch: Partial<ShotInput>) => void;
  onSubmit: (payload: ShotInput) => Promise<void>;
  workflow: "first" | "spare" | "second";
  availablePins: number[];
  handedness: Handedness;
  onRequestLineEdit?: () => void;
}) {
  const [details, setDetails] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const standingPins = parseLeave(form.leave_code, form.pinfall);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    await onSubmit({
      ...form,
      game_number: Math.round(form.game_number),
      frame_number: form.frame_number === null ? null : Math.round(form.frame_number),
      pinfall: Math.round(form.pinfall),
    });
  }

  const modeName = workflow === "first" ? "First ball" : workflow === "spare" ? "Spare" : "Second ball";

  return (
    <form className="shot-form simplified-shot-form" onSubmit={submit}>
      <div className="form-section-title">
        <div><small>{modeName} • Game {form.game_number}, frame {form.frame_number ?? "—"}</small><h3>What happened?</h3></div>
        <button type="button" className="text-button" onClick={() => setDetails((value) => !value)}>{details ? "Use easy view" : "More details"}</button>
      </div>

      <div className="easy-steps">
        <span><b>1</b> Choose the ball</span>
        <span><b>2</b> Tap the pins left standing</span>
        <span><b>3</b> Log the shot</span>
      </div>

      <div className="easy-form-grid">
        <label className="field">
          <span>Ball used</span>
          <select value={form.ball_id ?? ""} onChange={(event) => onChange({ ball_id: event.target.value ? Number(event.target.value) : null })}>
            <option value="">Unspecified</option>
            {balls.map((ball) => <option key={ball.id} value={ball.id}>{ball.manufacturer} {ball.model}</option>)}
          </select>
        </label>
        <NumberInput label="Speed (mph)" value={form.speed_mph} min={5} max={30} step={0.1} allowEmpty hint="Leave blank if the lane monitor did not show it." onChange={(value) => onChange({ speed_mph: value })} />
        <label className="field">
          <span>How did the release feel?</span>
          <select value={form.delivery_quality} onChange={(event) => onChange({ delivery_quality: event.target.value })}>
            <option value="good">Good / normal</option>
            <option value="unknown">Not sure</option>
            <option value="missed_left">Missed target left</option>
            <option value="missed_right">Missed target right</option>
            <option value="pulled">Pulled the shot</option>
            <option value="slow">Slower than normal</option>
            <option value="fast">Faster than normal</option>
          </select>
        </label>
      </div>

      <div className="current-setup-card">
        <div><small>Your current setup</small><strong>{handLabel(handedness)}</strong></div>
        <span>Feet <b>{formatBoard(toDisplayBoard(form.feet_board, handedness))}</b></span>
        <span>Distance <b>{form.feet_depth_ft.toFixed(1)} ft</b></span>
        <span>Target <b>{formatBoard(toDisplayBoard(form.target_board, handedness))}</b></span>
        <button type="button" onClick={onRequestLineEdit}>Edit line on lane</button>
      </div>

      {details && (
        <div className="details-panel">
          <div className="form-grid compact">
            <NumberInput label="Game" value={form.game_number} min={1} max={20} onChange={(value) => onChange({ game_number: value || 1 })} />
            <NumberInput label="Frame" value={form.frame_number} min={1} max={12} onChange={(value) => onChange({ frame_number: value })} />
            <NumberInput label={`Feet board (${handedness === "left" ? "LH" : "RH"})`} value={toDisplayBoard(form.feet_board, handedness)} min={1} max={39} step={0.5} onChange={(value) => onChange({ feet_board: toPhysicalBoard(value || 1, handedness) })} />
            <NumberInput label="Feet distance" value={form.feet_depth_ft} min={0.5} max={15} step={0.5} hint="Feet behind the foul line." onChange={(value) => onChange({ feet_depth_ft: value || 0.5 })} />
            <NumberInput label="Laydown board" value={toDisplayBoard(form.laydown_board, handedness)} min={1} max={39} step={0.5} onChange={(value) => onChange({ laydown_board: toPhysicalBoard(value || 1, handedness) })} />
            <NumberInput label="Arrow target" value={toDisplayBoard(form.target_board, handedness)} min={1} max={39} step={0.5} onChange={(value) => onChange({ target_board: toPhysicalBoard(value || 1, handedness) })} />
            <NumberInput label="Breakpoint" value={toDisplayBoard(form.breakpoint_board, handedness)} min={1} max={39} step={0.5} onChange={(value) => onChange({ breakpoint_board: toPhysicalBoard(value || 1, handedness) })} />
            <NumberInput label="Pocket" value={toDisplayBoard(form.pocket_board, handedness)} min={1} max={39} step={0.25} onChange={(value) => onChange({ pocket_board: toPhysicalBoard(value || 1, handedness) })} />
          </div>
          <button type="button" className="text-button advanced-toggle" onClick={() => setAdvanced((value) => !value)}>{advanced ? "Hide advanced release data" : "Show advanced release data"}</button>
          {advanced && (
            <div className="form-grid compact advanced-grid">
              <NumberInput label="Rev rate" value={form.rev_rate} min={0} max={800} allowEmpty onChange={(value) => onChange({ rev_rate: value })} />
              <NumberInput label="Axis rotation" value={form.axis_rotation} min={0} max={180} allowEmpty onChange={(value) => onChange({ axis_rotation: value })} />
              <NumberInput label="Axis tilt" value={form.axis_tilt} min={0} max={90} allowEmpty onChange={(value) => onChange({ axis_tilt: value })} />
              <label className="field span-4"><span>Notes</span><input value={form.notes ?? ""} placeholder="Optional note about the shot" onChange={(event) => onChange({ notes: event.target.value || null })} /></label>
            </div>
          )}
        </div>
      )}

      <PinLeaveSelector
        standingPins={standingPins}
        availablePins={availablePins}
        onChange={(pins) => onChange({ leave_code: stringifyLeave(pins), pinfall: Math.max(0, availablePins.length - pins.length) })}
      />

      <button className="primary-button wide log-shot-button" type="submit" disabled={busy}>
        {busy ? "Analyzing…" : workflow === "spare" ? "Log spare attempt" : "Log shot and get suggestion"}
      </button>
    </form>
  );
}
