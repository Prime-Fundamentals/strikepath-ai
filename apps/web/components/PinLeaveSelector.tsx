"use client";

const ALL_PINS = [1,2,3,4,5,6,7,8,9,10];

const pinLayout = [
  { pin: 7, row: 1, col: 1 },
  { pin: 8, row: 1, col: 3 },
  { pin: 9, row: 1, col: 5 },
  { pin: 10, row: 1, col: 7 },
  { pin: 4, row: 2, col: 2 },
  { pin: 5, row: 2, col: 4 },
  { pin: 6, row: 2, col: 6 },
  { pin: 2, row: 3, col: 3 },
  { pin: 3, row: 3, col: 5 },
  { pin: 1, row: 4, col: 4 },
];

function normalizePins(pins: number[]) {
  return [...new Set(pins)]
    .filter((pin) => pin >= 1 && pin <= 10)
    .sort((a, b) => a - b);
}

export function stringifyLeave(standingPins: number[]) {
  const normalized = normalizePins(standingPins);
  return normalized.length ? normalized.join("-") : null;
}

export function parseLeave(leaveCode: string | null, pinfall: number | null = null) {
  if (leaveCode) {
    return normalizePins(leaveCode.match(/10|[1-9]/g)?.map(Number) ?? []);
  }
  if (pinfall === 0) return ALL_PINS;
  if (pinfall === 10) return [];
  return [];
}

export function PinLeaveSelector({
  standingPins,
  availablePins = ALL_PINS,
  onChange,
}: {
  standingPins: number[];
  availablePins?: number[];
  onChange: (pins: number[]) => void;
}) {
  const available = normalizePins(availablePins);
  const standing = normalizePins(standingPins).filter((pin) => available.includes(pin));
  const knockedDown = available.length - standing.length;

  function togglePin(pin: number) {
    if (!available.includes(pin)) return;
    const next = standing.includes(pin)
      ? standing.filter((value) => value !== pin)
      : [...standing, pin];
    onChange(normalizePins(next));
  }

  return (
    <div className="pin-selector">
      <div className="pin-selector-top">
        <div>
          <small>Pin leave diagram</small>
          <strong>
            {available.length < 10 ? `${knockedDown} of ${available.length} spare pins converted` : `${knockedDown} pins down`}
          </strong>
        </div>
        <div className="pin-selector-actions">
          <button type="button" onClick={() => onChange([])}>
            {available.length < 10 ? "Converted" : "Strike"}
          </button>
          <button type="button" onClick={() => onChange(available)}>Reset standing</button>
        </div>
      </div>

      <div className="pin-selector-grid" role="group" aria-label="Select pins still standing">
        {pinLayout.map(({ pin, row, col }) => {
          const isAvailable = available.includes(pin);
          const isStanding = standing.includes(pin);
          return (
            <button
              key={pin}
              type="button"
              className={`pin-chip ${isStanding ? "standing" : "down"} ${!isAvailable ? "unavailable" : ""}`}
              style={{ gridRow: row, gridColumn: col }}
              onClick={() => togglePin(pin)}
              aria-pressed={isStanding}
              disabled={!isAvailable}
              title={!isAvailable ? `Pin ${pin} was already down` : isStanding ? `Pin ${pin} is standing` : `Pin ${pin} is down`}
            >
              <span>{pin}</span>
            </button>
          );
        })}
      </div>

      <p className="pin-selector-help">Viewed from the bowler: the 7-8-9-10 row is farthest away and the 1 pin is closest. Tap only the pins still standing.</p>
    </div>
  );
}
