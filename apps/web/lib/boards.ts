import type { Handedness } from "./types";

export const MIN_BOARD = 1;
export const MAX_BOARD = 39;

export function clampBoard(value: number) {
  return Math.min(MAX_BOARD, Math.max(MIN_BOARD, value));
}

/**
 * Database and physics calculations use one physical coordinate system:
 * board 1 is the physical right edge and board 39 is the physical left edge.
 * Left-handed bowlers see a mirrored display number without changing storage.
 */
export function toDisplayBoard(physicalBoard: number, handedness: Handedness) {
  const board = clampBoard(physicalBoard);
  return handedness === "left" ? 40 - board : board;
}

export function toPhysicalBoard(displayBoard: number, handedness: Handedness) {
  const board = clampBoard(displayBoard);
  return handedness === "left" ? 40 - board : board;
}

export function formatBoard(value: number, decimals = 2) {
  if (Number.isInteger(value)) return String(value);
  if (Math.abs(value * 2 - Math.round(value * 2)) < 0.0001) return value.toFixed(1);
  return value.toFixed(decimals).replace(/0+$/, "").replace(/\.$/, "");
}

export function handLabel(handedness: Handedness) {
  return handedness === "left" ? "Left-handed" : "Right-handed";
}

export function displayPocketBoard(handedness: Handedness) {
  return toDisplayBoard(handedness === "right" ? 17.5 : 22.5, handedness);
}
