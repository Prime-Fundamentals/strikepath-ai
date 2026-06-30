"use client";

import { useId, useMemo } from "react";
import type { Ball, Handedness, Shot, ShotInput } from "@/lib/types";
import type { AISuggestedSetup } from "@/lib/aiSetup";
import { formatBoard, handLabel, toDisplayBoard } from "@/lib/boards";
import { simulateBallPath, type PhysicsSample } from "@/lib/physicsEngine";
import { parseLeave } from "./PinLeaveSelector";

const WIDTH = 620;
const HEIGHT = 880;
const CENTER = WIDTH / 2;
const NEAR_Y = 790;
const FAR_Y = 112;
const NEAR_HALF = 248;
const FAR_HALF = 58;
const ALL_PINS = [1,2,3,4,5,6,7,8,9,10];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function perspectivePoint(board: number, distanceFt: number) {
  const t = clamp(distanceFt / 60, 0, 1);
  const depth = Math.pow(t, 0.72);
  const half = NEAR_HALF + (FAR_HALF - NEAR_HALF) * depth;
  const boardRatio = (20 - board) / 19;
  return {
    x: CENTER + boardRatio * half,
    y: NEAR_Y + (FAR_Y - NEAR_Y) * depth,
  };
}

function pathFromSamples(samples: PhysicsSample[]) {
  return samples.map((sample, index) => {
    const point = perspectivePoint(sample.board, sample.distanceFt);
    return `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`;
  }).join(" ");
}

function setupAsShot(setup: AISuggestedSetup, source: ShotInput | Shot): ShotInput {
  return {
    ball_id: source.ball_id,
    game_number: source.game_number,
    frame_number: source.frame_number,
    feet_board: setup.feetBoard,
    feet_depth_ft: setup.feetDepthFt,
    laydown_board: setup.laydownBoard,
    target_board: setup.targetBoard,
    breakpoint_board: setup.breakpointBoard,
    pocket_board: setup.pocketBoard,
    speed_mph: setup.speedMph,
    rev_rate: source.rev_rate,
    axis_rotation: source.axis_rotation,
    axis_tilt: source.axis_tilt,
    pinfall: source.pinfall,
    leave_code: source.leave_code,
    delivery_quality: source.delivery_quality,
    notes: source.notes,
  };
}

export function BowlerPerspectiveLane({
  shot,
  handedness,
  oilLengthFt,
  activeBall,
  aiSetup,
  showAiSuggestion,
}: {
  shot: ShotInput | Shot | null;
  handedness: Handedness;
  oilLengthFt: number;
  activeBall?: Ball | null;
  aiSetup?: AISuggestedSetup | null;
  showAiSuggestion?: boolean;
}) {
  const id = useId().replace(/:/g, "_");
  const physics = useMemo(() => shot ? simulateBallPath({ shot, handedness, oilLengthFt, ball: activeBall }) : null, [shot, handedness, oilLengthFt, activeBall]);
  const aiPhysics = useMemo(() => shot && aiSetup ? simulateBallPath({ shot: setupAsShot(aiSetup, shot), handedness, oilLengthFt, ball: activeBall }) : null, [shot, aiSetup, handedness, oilLengthFt, activeBall]);
  const standingPins = shot ? parseLeave(shot.leave_code, shot.pinfall) : ALL_PINS;
  const currentPath = physics ? pathFromSamples(physics.samples) : "";
  const suggestedPath = aiPhysics ? pathFromSamples(aiPhysics.samples) : "";
  const arrowY = perspectivePoint(20, 15).y;
  const dotY = perspectivePoint(20, 7).y;

  return (
    <div className="perspective-lane-card">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="perspective-lane-svg" role="img" aria-label={`${handLabel(handedness)} bowler perspective lane`}>
        <defs>
          <linearGradient id={`${id}_wood`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#d8ae70" />
            <stop offset=".55" stopColor="#c68d4d" />
            <stop offset="1" stopColor="#e0b575" />
          </linearGradient>
          <linearGradient id={`${id}_gutter`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#05080c" />
            <stop offset=".5" stopColor="#34414a" />
            <stop offset="1" stopColor="#080d12" />
          </linearGradient>
          <filter id={`${id}_glow`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        <rect x="8" y="38" width="604" height="814" rx="24" fill="#040b12" stroke="#18324a" strokeWidth="2" />
        <path d={`M ${CENTER-NEAR_HALF-28} ${NEAR_Y+4} L ${CENTER-FAR_HALF-14} ${FAR_Y-8} L ${CENTER-FAR_HALF} ${FAR_Y} L ${CENTER-NEAR_HALF} ${NEAR_Y} Z`} fill={`url(#${id}_gutter)`} />
        <path d={`M ${CENTER+NEAR_HALF+28} ${NEAR_Y+4} L ${CENTER+FAR_HALF+14} ${FAR_Y-8} L ${CENTER+FAR_HALF} ${FAR_Y} L ${CENTER+NEAR_HALF} ${NEAR_Y} Z`} fill={`url(#${id}_gutter)`} />
        <path d={`M ${CENTER-NEAR_HALF} ${NEAR_Y} L ${CENTER-FAR_HALF} ${FAR_Y} L ${CENTER+FAR_HALF} ${FAR_Y} L ${CENTER+NEAR_HALF} ${NEAR_Y} Z`} fill={`url(#${id}_wood)`} stroke="#7d522b" strokeWidth="2" />

        {Array.from({length:40}).map((_, index) => {
          const board = 39 - index * (38 / 39);
          const near = perspectivePoint(board, 0);
          const far = perspectivePoint(board, 60);
          return <line key={index} x1={near.x} y1={near.y} x2={far.x} y2={far.y} stroke="#70431f" strokeOpacity={index % 5 === 0 ? ".35" : ".14"} strokeWidth={index % 5 === 0 ? 1.1 : .55} />;
        })}

        <line x1={CENTER-NEAR_HALF} y1={NEAR_Y} x2={CENTER+NEAR_HALF} y2={NEAR_Y} stroke="#fff" strokeWidth="8" />
        {[5,10,15,20,25,30,35].map((board) => {
          const p = perspectivePoint(board, 15);
          const size = 7;
          return <path key={board} d={`M ${p.x} ${arrowY-size} L ${p.x+size} ${arrowY+size} L ${p.x-size} ${arrowY+size} Z`} fill="#30373d" />;
        })}
        {[3,8,13,18,22,27,32,37].map((board) => {
          const p = perspectivePoint(board, 7);
          return <circle key={board} cx={p.x} cy={dotY} r="3" fill="#2e3439" />;
        })}

        <g className="perspective-pin-rack">
          {[
            {pin:7,x:-45,y:-10},{pin:8,x:-15,y:-10},{pin:9,x:15,y:-10},{pin:10,x:45,y:-10},
            {pin:4,x:-30,y:9},{pin:5,x:0,y:9},{pin:6,x:30,y:9},
            {pin:2,x:-15,y:28},{pin:3,x:15,y:28},{pin:1,x:0,y:47},
          ].map((item) => (
            <g key={item.pin} transform={`translate(${CENTER+item.x} ${FAR_Y-10+item.y})`} opacity={standingPins.includes(item.pin) ? 1 : .18}>
              <ellipse cx="0" cy="10" rx="8" ry="3" fill="rgba(0,0,0,.25)" />
              <path d="M0-15 C-5-15-7-11-6-6 C-5-1-7 5-8 9 C-9 15-5 20 0 20 C5 20 9 15 8 9 C7 5 5-1 6-6 C7-11 5-15 0-15Z" fill="#fff" stroke="#c9dce6" />
              <path d="M-5-5 H5" stroke="#e84352" strokeWidth="3" />
            </g>
          ))}
        </g>

        {showAiSuggestion && suggestedPath && <path d={suggestedPath} fill="none" stroke="#c999ff" strokeWidth="4" strokeDasharray="12 9" opacity=".9" />}
        {currentPath && <path d={currentPath} fill="none" stroke="#72faff" strokeWidth="6" strokeLinecap="round" filter={`url(#${id}_glow)`} />}

        {physics && (
          <>
            <circle {...perspectivePoint(physics.projectedBreakpointBoard, physics.skidEndFt)} r="8" fill="#ffc663" stroke="#fff" strokeWidth="2" />
            <circle {...perspectivePoint(physics.projectedPocketBoard, 60)} r="9" fill="#fff" stroke="#00ecff" strokeWidth="3" />
          </>
        )}

        <text x={CENTER} y="28" textAnchor="middle" fill="#8ef8ff" fontSize="14" fontWeight="900" letterSpacing=".12em">BOWLER-PERSPECTIVE VIEW</text>
        <text x={CENTER} y="834" textAnchor="middle" fill="#6d8a9d" fontSize="11">Perspective is for visualization. Switch to Overhead to edit exact marker positions.</text>
      </svg>
      {physics && (
        <div className="perspective-phase-row">
          <span><small>Skid ends</small><b>{physics.skidEndFt.toFixed(1)} ft</b></span>
          <span><small>Hook ends</small><b>{physics.hookEndFt.toFixed(1)} ft</b></span>
          <span><small>Entry angle</small><b>{physics.entryAngleDeg.toFixed(1)}°</b></span>
        </div>
      )}
    </div>
  );
}
