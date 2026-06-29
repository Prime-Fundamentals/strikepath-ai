"use client";

const pinLayout = [
  { pin: 7, row: 3, col: 0 },
  { pin: 8, row: 3, col: 1 },
  { pin: 9, row: 3, col: 2 },
  { pin: 10, row: 3, col: 3 },
  { pin: 4, row: 2, col: 0.5 },
  { pin: 5, row: 2, col: 1.5 },
  { pin: 6, row: 2, col: 2.5 },
  { pin: 2, row: 1, col: 1 },
  { pin: 3, row: 1, col: 2 },
  { pin: 1, row: 0, col: 1.5 },
];

function normalizeStanding(standingPins: number[]) {
  return [...new Set(standingPins)].filter((pin) => pin >= 1 && pin <= 10).sort((a, b) => a - b);
}

export function stringifyLeave(standingPins: number[]) {
  const normalized = normalizeStanding(standingPins);
  return normalized.length ? normalized.join("-") : null;
}

export function parseLeave(leaveCode: string | null, pinfall: number | null = null) {
  if (leaveCode) {
    const pins = leaveCode.match(/10|[1-9]/g)?.map(Number) ?? [];
    return normalizeStanding(pins);
  }
  if (pinfall === 10) return [];
  if (pinfall === 0) return [1,2,3,4,5,6,7,8,9,10];
  return [];
}

export function PinLeaveSelector({
  standingPins,
  onChange,
}: {
  standingPins: number[];
  onChange: (pins: number[]) => void;
}) {
  const normalized = normalizeStanding(standingPins);

  function togglePin(pin: number) {
    const next = normalized.includes(pin)
      ? normalized.filter((value) => value !== pin)
      : [...normalized, pin];
    onChange(normalizeStanding(next));
  }

  return (
    <div className="pin-selector">
      <div className="pin-selector-top">
        <div>
          <small>Pin leave diagram</small>
          <strong>{normalized.length ? `Standing pins: ${normalized.join(", ")}` : "Strike / all pins cleared"}</strong>
        </div>
        <div className="pin-selector-actions">
          <button type="button" onClick={() => onChange([])}>Strike</button>
          <button type="button" onClick={() => onChange([1,2,3,4,5,6,7,8,9,10])}>Reset rack</button>
        </div>
      </div>
      <div className="pin-selector-grid" role="group" aria-label="Select standing pins">
        {pinLayout.map(({ pin, row, col }) => {
          const active = normalized.includes(pin);
          return (
            <button
              key={pin}
              type="button"
              className={`pin-chip ${active ? "standing" : "down"}`}
              style={{ gridRow: row + 1, gridColumn: col + 1 }}
              onClick={() => togglePin(pin)}
              aria-pressed={active}
              title={active ? `Pin ${pin} is standing` : `Pin ${pin} is knocked down`}
            >
              <span>{pin}</span>
            </button>
          );
        })}
      </div>
      <p className="pin-selector-help">Tap the exact pins left standing after the shot. Pinfall updates automatically.</p>
    </div>
  );
}
