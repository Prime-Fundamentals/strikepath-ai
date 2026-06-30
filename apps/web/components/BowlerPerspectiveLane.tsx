"use client";

import { useId, useMemo } from "react";
import type { Ball, Handedness, Shot, ShotInput } from "@/lib/types";
import type { AISuggestedSetup } from "@/lib/aiSetup";
import { handLabel } from "@/lib/boards";
import { simulateBallPath, type PhysicsSample } from "@/lib/physicsEngine";
import { parseLeave } from "./PinLeaveSelector";
import styles from "./LaneCanvas.module.css";

const WIDTH = 660;
const HEIGHT = 760;
const CENTER = WIDTH / 2;
const NEAR_Y = 675;
const FAR_Y = 120;
const NEAR_HALF = 270;
const FAR_HALF = 68;
const ALL_PINS = [1,2,3,4,5,6,7,8,9,10];

function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)); }
function perspectivePoint(board: number, distanceFt: number) {
  const t = clamp(distanceFt / 60, 0, 1);
  const depth = Math.pow(t, .72);
  const half = NEAR_HALF + (FAR_HALF - NEAR_HALF) * depth;
  const ratio = (20 - board) / 19;
  return { x:CENTER + ratio * half, y:NEAR_Y + (FAR_Y - NEAR_Y) * depth };
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

const pinLayout = [
  {pin:7,x:-45,y:-5},{pin:8,x:-15,y:-5},{pin:9,x:15,y:-5},{pin:10,x:45,y:-5},
  {pin:4,x:-30,y:12},{pin:5,x:0,y:12},{pin:6,x:30,y:12},
  {pin:2,x:-15,y:29},{pin:3,x:15,y:29},{pin:1,x:0,y:46},
];

export function BowlerPerspectiveLane({ shot, handedness, oilLengthFt, activeBall, aiSetup, showAiSuggestion }: {
  shot: ShotInput | Shot | null;
  handedness: Handedness;
  oilLengthFt: number;
  activeBall?: Ball | null;
  aiSetup?: AISuggestedSetup | null;
  showAiSuggestion?: boolean;
}) {
  const id = useId().replace(/:/g,"_");
  const physics = useMemo(() => shot ? simulateBallPath({ shot, handedness, oilLengthFt, ball: activeBall }) : null, [shot, handedness, oilLengthFt, activeBall]);
  const aiPhysics = useMemo(() => shot && aiSetup ? simulateBallPath({ shot:setupAsShot(aiSetup, shot), handedness, oilLengthFt, ball:activeBall }) : null, [shot, aiSetup, handedness, oilLengthFt, activeBall]);
  const standingPins = shot ? parseLeave(shot.leave_code, shot.pinfall) : ALL_PINS;
  const currentPath = physics ? pathFromSamples(physics.samples) : "";
  const suggestedPath = aiPhysics ? pathFromSamples(aiPhysics.samples) : "";
  const arrowY = perspectivePoint(20,15).y;
  const dotY = perspectivePoint(20,7).y;

  return (
    <div className={styles.perspectiveCard}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className={styles.perspectiveSvg} role="img" aria-label={`${handLabel(handedness)} bowler perspective lane`}>
        <defs>
          <linearGradient id={`${id}_wood`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#b77b40"/><stop offset=".5" stopColor="#e0b477"/><stop offset="1" stopColor="#b77b40"/></linearGradient>
          <linearGradient id={`${id}_gutter`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#071019"/><stop offset=".5" stopColor="#2b343a"/><stop offset="1" stopColor="#070c11"/></linearGradient>
          <filter id={`${id}_glow`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <rect x="18" y="18" width="624" height="724" rx="24" fill="#050d16" stroke="#1b3850" strokeWidth="2"/>
        <text x={CENTER} y="44" textAnchor="middle" fill="#87f7ff" fontSize="14" fontWeight="900" letterSpacing=".13em">BOWLER VIEW</text>
        <text x={CENTER} y="64" textAnchor="middle" fill="#6d899a" fontSize="10">{handLabel(handedness)} setup · visual reference only</text>

        <path d={`M ${CENTER-NEAR_HALF-30} ${NEAR_Y+4} L ${CENTER-FAR_HALF-15} ${FAR_Y-10} L ${CENTER-FAR_HALF} ${FAR_Y} L ${CENTER-NEAR_HALF} ${NEAR_Y} Z`} fill={`url(#${id}_gutter)`}/>
        <path d={`M ${CENTER+NEAR_HALF+30} ${NEAR_Y+4} L ${CENTER+FAR_HALF+15} ${FAR_Y-10} L ${CENTER+FAR_HALF} ${FAR_Y} L ${CENTER+NEAR_HALF} ${NEAR_Y} Z`} fill={`url(#${id}_gutter)`}/>
        <path d={`M ${CENTER-NEAR_HALF} ${NEAR_Y} L ${CENTER-FAR_HALF} ${FAR_Y} L ${CENTER+FAR_HALF} ${FAR_Y} L ${CENTER+NEAR_HALF} ${NEAR_Y} Z`} fill={`url(#${id}_wood)`} stroke="#7d522b" strokeWidth="2"/>

        {Array.from({length:40}).map((_,index) => {
          const board = 39 - index * (38/39);
          const near = perspectivePoint(board,0), far = perspectivePoint(board,60);
          return <line key={index} x1={near.x} y1={near.y} x2={far.x} y2={far.y} stroke="#70431f" strokeOpacity={index%5===0?.3:.12} strokeWidth={index%5===0?1:.5}/>;
        })}
        <line x1={CENTER-NEAR_HALF} y1={NEAR_Y} x2={CENTER+NEAR_HALF} y2={NEAR_Y} stroke="#fff" strokeWidth="8"/>
        {[5,10,15,20,25,30,35].map((board) => { const p=perspectivePoint(board,15); return <path key={board} d={`M ${p.x} ${arrowY-6} L ${p.x+6} ${arrowY+6} L ${p.x-6} ${arrowY+6} Z`} fill="#30373d"/>; })}
        {[3,8,13,18,22,27,32,37].map((board) => { const p=perspectivePoint(board,7); return <circle key={board} cx={p.x} cy={dotY} r="2.5" fill="#30373d"/>; })}

        <g>
          {pinLayout.map((item) => (
            <g key={item.pin} transform={`translate(${CENTER+item.x} ${FAR_Y-9+item.y})`} opacity={standingPins.includes(item.pin)?1:.17}>
              <ellipse cx="0" cy="8" rx="5" ry="2" fill="rgba(0,0,0,.24)"/>
              <path d="M0-10 C-3.5-10-5-7-4.3-3.8 C-3.4-.5-4.7 3.6-5.4 6.5 C-6 10-3.5 13 0 13 C3.5 13 6 10 5.4 6.5 C4.7 3.6 3.4-.5 4.3-3.8 C5-7 3.5-10 0-10Z" fill="#fff" stroke="#c9dce6" strokeWidth=".8"/>
              <path d="M-3-3 H3" stroke="#e84352" strokeWidth="2"/>
            </g>
          ))}
        </g>

        {showAiSuggestion && suggestedPath && <path d={suggestedPath} fill="none" stroke="#c999ff" strokeWidth="3" strokeDasharray="10 8" opacity=".88"/>}
        {currentPath && <><path d={currentPath} fill="none" stroke="#72faff" strokeOpacity=".18" strokeWidth="10" filter={`url(#${id}_glow)`}/><path d={currentPath} fill="none" stroke="#8fffff" strokeWidth="4.5" strokeLinecap="round"/></>}

        {physics && <>
          <circle {...perspectivePoint(physics.projectedBreakpointBoard,44)} r="7" fill="#ffc663" stroke="#fff" strokeWidth="2"/>
          <circle {...perspectivePoint(physics.projectedPocketBoard,60)} r="8" fill="#fff" stroke="#00ecff" strokeWidth="2.5"/>
        </>}
        <text x={CENTER} y="720" textAnchor="middle" fill="#6d8a9d" fontSize="10">Use Overhead view to edit exact positions.</text>
      </svg>
      {physics && <div className={styles.summaryRow}>
        <span><small>Skid ends</small><b>{physics.skidEndFt.toFixed(1)} ft</b></span>
        <span><small>Hook ends</small><b>{physics.hookEndFt.toFixed(1)} ft</b></span>
        <span><small>Entry angle</small><b>{physics.entryAngleDeg.toFixed(1)}°</b></span>
      </div>}
    </div>
  );
}
