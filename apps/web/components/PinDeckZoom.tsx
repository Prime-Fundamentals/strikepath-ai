"use client";

import type { Handedness, Shot, ShotInput } from "@/lib/types";
import type { AISuggestedSetup } from "@/lib/aiSetup";
import { formatBoard, toDisplayBoard } from "@/lib/boards";
import { parseLeave } from "./PinLeaveSelector";

const WIDTH = 760;
const HEIGHT = 450;
const DECK_LEFT = 90;
const DECK_WIDTH = 580;
const DECK_TOP = 52;
const DECK_HEIGHT = 330;

const pinBoards: Record<number, number> = {
  1: 20,
  2: 25,
  3: 15,
  4: 30,
  5: 20,
  6: 10,
  7: 35,
  8: 25,
  9: 15,
  10: 5,
};

const pinRows: Record<number, number> = {
  7: 0, 8: 0, 9: 0, 10: 0,
  4: 1, 5: 1, 6: 1,
  2: 2, 3: 2,
  1: 3,
};

function xForBoard(board: number) {
  return DECK_LEFT + ((39 - board) / 38) * DECK_WIDTH;
}

function yForPin(pin: number) {
  return DECK_TOP + 62 + pinRows[pin] * 70;
}

function leadPin(standingPins: number[]) {
  const order = [1,2,3,4,5,6,7,8,9,10];
  return order.find((pin) => standingPins.includes(pin)) ?? null;
}

function impactLabel(standingPins: number[]) {
  if (!standingPins.length) return "Strike result";
  if (standingPins.length === 1) return `Direct center hit on pin ${standingPins[0]}`;
  const lead = leadPin(standingPins);
  return lead ? `Enter through pin ${lead} and drive into the remaining cluster` : "Review the spare cluster";
}

export function PinDeckZoom({
  shot,
  handedness,
  aiSetup,
}: {
  shot: ShotInput | Shot | null;
  handedness: Handedness;
  aiSetup?: AISuggestedSetup | null;
}) {
  const standingPins = shot ? parseLeave(shot.leave_code, shot.pinfall) : [1,2,3,4,5,6,7,8,9,10];
  const impactBoard = aiSetup?.pocketBoard ?? shot?.pocket_board ?? 20;
  const lead = leadPin(standingPins);
  const leadBoard = lead ? pinBoards[lead] : impactBoard;
  const entryBoard = aiSetup?.pocketBoard ?? leadBoard;
  const entryX = xForBoard(entryBoard);
  const leadY = lead ? yForPin(lead) : yForPin(1);

  return (
    <div className="pin-deck-zoom-card">
      <div className="pin-deck-zoom-heading">
        <div>
          <small>PIN-DECK ZOOM</small>
          <h3>Impact zone and spare entry</h3>
        </div>
        <span>{impactLabel(standingPins)}</span>
      </div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="pin-deck-zoom-svg" role="img" aria-label="Enlarged bowling pin deck with impact zone">
        <defs>
          <linearGradient id="pinDeckWood" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#c58c50" />
            <stop offset=".18" stopColor="#e5bd80" />
            <stop offset=".36" stopColor="#bd8147" />
            <stop offset=".58" stopColor="#edc98f" />
            <stop offset=".78" stopColor="#c48a4e" />
            <stop offset="1" stopColor="#e1b779" />
          </linearGradient>
          <radialGradient id="impactGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#ffffff" stopOpacity=".92" />
            <stop offset=".28" stopColor="#60f4ff" stopOpacity=".58" />
            <stop offset="1" stopColor="#60f4ff" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect x="20" y="18" width="720" height="412" rx="24" fill="#050d17" stroke="#1c3a52" strokeWidth="2" />
        <rect x={DECK_LEFT - 26} y={DECK_TOP} width="20" height={DECK_HEIGHT} rx="10" fill="#1b2730" />
        <rect x={DECK_LEFT + DECK_WIDTH + 6} y={DECK_TOP} width="20" height={DECK_HEIGHT} rx="10" fill="#1b2730" />
        <rect x={DECK_LEFT} y={DECK_TOP} width={DECK_WIDTH} height={DECK_HEIGHT} rx="10" fill="url(#pinDeckWood)" />

        {Array.from({length:39}).map((_, index) => {
          const x = DECK_LEFT + (DECK_WIDTH / 38) * index;
          return <line key={index} x1={x} y1={DECK_TOP} x2={x} y2={DECK_TOP + DECK_HEIGHT} stroke="#70431f" strokeOpacity={index % 5 === 0 ? ".32" : ".14"} strokeWidth={index % 5 === 0 ? 1 : .55} />;
        })}

        {[39,35,30,25,20,15,10,5,1].map((board) => (
          <g key={board}>
            <text x={xForBoard(board)} y={DECK_TOP + DECK_HEIGHT + 26} textAnchor="middle" fill="#e9f8ff" fontSize="14" fontWeight="900">{formatBoard(toDisplayBoard(board, handedness))}</text>
            <line x1={xForBoard(board)} y1={DECK_TOP + DECK_HEIGHT - 8} x2={xForBoard(board)} y2={DECK_TOP + DECK_HEIGHT} stroke="#dce8ef" opacity=".55" />
          </g>
        ))}

        <path d={`M ${entryX} ${DECK_TOP + DECK_HEIGHT - 18} L ${entryX} ${leadY + 18}`} stroke="#c999ff" strokeWidth="5" strokeDasharray="12 9" fill="none" />
        <circle cx={entryX} cy={leadY} r="48" fill="url(#impactGlow)" opacity=".88" />
        <circle cx={entryX} cy={leadY} r="22" fill="none" stroke="#6af4ff" strokeWidth="3" strokeDasharray="5 5" />
        <line x1={entryX-30} y1={leadY} x2={entryX+30} y2={leadY} stroke="#fff" strokeWidth="2" />
        <line x1={entryX} y1={leadY-30} x2={entryX} y2={leadY+30} stroke="#fff" strokeWidth="2" />

        {Object.keys(pinBoards).map((key) => {
          const pin = Number(key);
          const x = xForBoard(pinBoards[pin]);
          const y = yForPin(pin);
          const standing = standingPins.includes(pin);
          return (
            <g key={pin} transform={`translate(${x} ${y})`} opacity={standing ? 1 : .18}>
              <ellipse cx="2" cy="4" rx="25" ry="22" fill="rgba(0,0,0,.24)" />
              <circle r="22" fill={standing ? "#fff" : "#7e8d98"} stroke={standing ? "#d7e9f2" : "#5d6c76"} strokeWidth="2" />
              <circle r="13" fill="none" stroke={standing ? "#e84755" : "#65737d"} strokeWidth="5" />
              <circle r="8" fill={standing ? "#fff" : "#84919b"} />
              <text x="0" y="4" textAnchor="middle" fill="#07141d" fontSize="10" fontWeight="900">{pin}</text>
            </g>
          );
        })}

        <rect x="250" y="27" width="260" height="30" rx="15" fill="rgba(5,18,29,.9)" stroke="#6af4ff" />
        <text x="380" y="47" textAnchor="middle" fill="#effcff" fontSize="13" fontWeight="900">Entry board {formatBoard(toDisplayBoard(entryBoard, handedness))}</text>
      </svg>
      <div className="pin-impact-tips">
        <span><small>Standing pins</small><b>{standingPins.length ? standingPins.join("-") : "None"}</b></span>
        <span><small>Lead pin</small><b>{lead ?? "—"}</b></span>
        <span><small>Suggested entry</small><b>Board {formatBoard(toDisplayBoard(entryBoard, handedness))}</b></span>
      </div>
    </div>
  );
}
