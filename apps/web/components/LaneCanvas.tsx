"use client";

import { useMemo, useRef, useState } from "react";
import type { Handedness, LaneState, Shot, ShotInput } from "@/lib/types";
import type { AISuggestedSetup } from "@/lib/aiSetup";
import { formatBoard, handLabel, toDisplayBoard } from "@/lib/boards";
import { parseLeave } from "./PinLeaveSelector";

type EditableField = "feet_board" | "laydown_board" | "target_board" | "breakpoint_board" | "pocket_board";
type PlacementMode = EditableField | "path";
type DragState =
  | { type: "field"; field: EditableField; pointerId: number }
  | { type: "path"; pointerId: number; startX: number; initial: Pick<ShotInput, EditableField> };

const VIEW_WIDTH = 620;
const VIEW_HEIGHT = 950;
const LANE_LEFT = 128;
const LANE_TOP = 86;
const LANE_WIDTH = 364;
const LANE_LENGTH = 600;
const FOUL_LINE_Y = LANE_TOP + LANE_LENGTH;
const APPROACH_BOTTOM = 882;
const APPROACH_MAX_FT = 15;
const BOARD_GAP = LANE_WIDTH / 38;
const ALL_PINS = [1,2,3,4,5,6,7,8,9,10];
const MAJOR_PHYSICAL_BOARDS = [39,35,30,25,20,15,10,5,1];
const APPROACH_DOT_BOARDS = [35,30,25,20,15,10,5];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundTo(value: number, step: number) {
  return Math.round(value / step) * step;
}

function xForBoard(board: number) {
  return LANE_LEFT + ((39 - board) / 38) * LANE_WIDTH;
}

function yForDistance(distance: number) {
  return FOUL_LINE_Y - (distance / 60) * LANE_LENGTH;
}

function yForFeetDepth(depthFt: number) {
  return FOUL_LINE_Y + (clamp(depthFt, 0.5, APPROACH_MAX_FT) / APPROACH_MAX_FT) * (APPROACH_BOTTOM - FOUL_LINE_Y);
}

function boardForSvgX(x: number, step: number) {
  const ratio = clamp((x - LANE_LEFT) / LANE_WIDTH, 0, 1);
  return clamp(roundTo(39 - ratio * 38, step), 1, 39);
}

function feetDepthForSvgY(y: number) {
  const ratio = clamp((y - FOUL_LINE_Y) / (APPROACH_BOTTOM - FOUL_LINE_Y), 0, 1);
  return clamp(roundTo(ratio * APPROACH_MAX_FT, 0.5), 0.5, APPROACH_MAX_FT);
}

function pointerToSvg(svg: SVGSVGElement, clientX: number, clientY: number) {
  const rect = svg.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * VIEW_WIDTH,
    y: ((clientY - rect.top) / rect.height) * VIEW_HEIGHT,
  };
}

function pathForShot(shot: Pick<ShotInput, "laydown_board" | "target_board" | "breakpoint_board" | "pocket_board">) {
  return `M ${xForBoard(shot.laydown_board)} ${yForDistance(1.5)} C ${xForBoard(shot.target_board)} ${yForDistance(15)} ${xForBoard(shot.breakpoint_board)} ${yForDistance(44)} ${xForBoard(shot.pocket_board)} ${yForDistance(59)}`;
}

const pinPositions = {
  7: { x: -3, y: 0 }, 8: { x: -1, y: 0 }, 9: { x: 1, y: 0 }, 10: { x: 3, y: 0 },
  4: { x: -2, y: 18 }, 5: { x: 0, y: 18 }, 6: { x: 2, y: 18 },
  2: { x: -1, y: 36 }, 3: { x: 1, y: 36 }, 1: { x: 0, y: 54 },
} as const;

function Pin({ x, y, standing, impact, pinNumber }: { x: number; y: number; standing: boolean; impact: boolean; pinNumber: number }) {
  return (
    <g transform={`translate(${x} ${y})`} opacity={standing ? 1 : 0.18}>
      {impact && <animate attributeName="opacity" values={standing ? ".3;1;.82;1" : "1;.48;.18"} dur=".7s" fill="freeze" />}
      <ellipse cx="0" cy="15" rx="7.6" ry="3" fill="rgba(0,0,0,.22)" />
      <path d="M0-12C-4.8-12-7.2-8.4-6.1-3.9C-5.1 0-5.2 2.9-6.7 6.2C-8.5 10.1-5.2 15.2 0 15.2C5.2 15.2 8.5 10.1 6.7 6.2C5.2 2.9 5.1 0 6.1-3.9C7.2-8.4 4.8-12 0-12Z" fill={standing ? "#fff" : "#7c8e9b"} stroke={standing ? "#bdd9e8" : "#627380"} strokeWidth="1.2" />
      <rect x="-1.4" y="-17" width="2.8" height="6" rx="1.4" fill="#ed3d50" />
      <text x="0" y="5" textAnchor="middle" fill={standing ? "#07141d" : "#465762"} fontSize="8" fontWeight="900">{pinNumber}</text>
    </g>
  );
}

const markerInfo: Record<EditableField, { label: string; color: string; fill: string }> = {
  feet_board: { label: "Feet", color: "#65ecff", fill: "#071827" },
  laydown_board: { label: "Laydown", color: "#7fe8ff", fill: "#071827" },
  target_board: { label: "Target", color: "#00f5ff", fill: "#00dce8" },
  breakpoint_board: { label: "Breakpoint", color: "#ffc663", fill: "#ffc663" },
  pocket_board: { label: "Pocket", color: "#8cf8ff", fill: "#fff" },
};

function EditMarker({ field, board, pointY, handedness, active, onPointerDown }: {
  field: EditableField;
  board: number;
  pointY: number;
  handedness: Handedness;
  active: boolean;
  onPointerDown: (event: React.PointerEvent<SVGGElement>) => void;
}) {
  const info = markerInfo[field];
  const x = xForBoard(board);
  const display = formatBoard(toDisplayBoard(board, handedness));
  const labelWidth = field === "breakpoint_board" ? 112 : 94;
  const labelX = clamp(x - labelWidth / 2, LANE_LEFT + 4, LANE_LEFT + LANE_WIDTH - labelWidth - 4);
  const labelY = field === "feet_board" ? pointY + 14 : pointY - 34;

  return (
    <g className={`lane-marker interactive ${active ? "active" : ""}`} onPointerDown={onPointerDown}>
      <circle cx={x} cy={pointY} r={active ? 10 : 8.5} fill={info.fill} stroke="#fff" strokeWidth={active ? 3 : 2} />
      <rect x={labelX} y={labelY} width={labelWidth} height="24" rx="12" fill="rgba(5,18,29,.96)" stroke={info.color} strokeWidth={active ? 1.8 : 1} />
      <text x={labelX + labelWidth / 2} y={labelY + 16} textAnchor="middle" fill="#ecfbff" fontSize="10.5" fontWeight="800">{info.label} {display}</text>
    </g>
  );
}

function SimplePoint({ x, y, color, ring = false }: { x: number; y: number; color: string; ring?: boolean }) {
  return <circle cx={x} cy={y} r={ring ? 7.5 : 6} fill={ring ? "#071827" : color} stroke={color} strokeWidth={ring ? 3 : 2} />;
}

function AISuggestionOverlay({ setup, handedness }: { setup: AISuggestedSetup; handedness: Handedness }) {
  const path = pathForShot({
    laydown_board: setup.laydownBoard,
    target_board: setup.targetBoard,
    breakpoint_board: setup.breakpointBoard,
    pocket_board: setup.pocketBoard,
  });
  const feetX = xForBoard(setup.feetBoard);
  const feetY = yForFeetDepth(setup.feetDepthFt);
  const targetX = xForBoard(setup.targetBoard);
  const targetY = yForDistance(15);
  return (
    <g className="ai-lane-overlay">
      <path d={`M ${feetX} ${feetY} L ${xForBoard(setup.laydownBoard)} ${yForDistance(1.5)}`} fill="none" stroke="#c999ff" strokeWidth="3" strokeDasharray="7 7" />
      <path d={path} fill="none" stroke="#ffffff" strokeWidth="5" opacity=".16" />
      <path d={path} fill="none" stroke="#c999ff" strokeWidth="3" strokeDasharray="10 8" />
      <circle cx={feetX} cy={feetY} r="10" fill="#26143d" stroke="#d8b7ff" strokeWidth="3" />
      <circle cx={targetX} cy={targetY} r="8" fill="#26143d" stroke="#d8b7ff" strokeWidth="3" />
      <rect x={clamp(feetX - 55, LANE_LEFT, LANE_LEFT + LANE_WIDTH - 110)} y={feetY - 38} width="110" height="24" rx="12" fill="#241536" stroke="#c999ff" />
      <text x={clamp(feetX, LANE_LEFT + 55, LANE_LEFT + LANE_WIDTH - 55)} y={feetY - 22} textAnchor="middle" fill="#f3e8ff" fontSize="10" fontWeight="900">AI FEET {formatBoard(toDisplayBoard(setup.feetBoard, handedness))}</text>
    </g>
  );
}

const placementOptions: Array<{ key: PlacementMode; label: string }> = [
  { key: "path", label: "Move whole line" },
  { key: "feet_board", label: "Feet" },
  { key: "laydown_board", label: "Laydown" },
  { key: "target_board", label: "Target" },
  { key: "breakpoint_board", label: "Breakpoint" },
  { key: "pocket_board", label: "Pocket" },
];

export function LaneCanvas({
  shots,
  laneState: _laneState,
  editableShot,
  onEditShot,
  resultShot = null,
  handedness,
  editMode = false,
  showAiSuggestion = false,
  aiSetup = null,
}: {
  shots: Shot[];
  laneState: LaneState | null;
  editableShot?: ShotInput | null;
  onEditShot?: (patch: Partial<ShotInput>) => void;
  resultShot?: Shot | null;
  handedness: Handedness;
  editMode?: boolean;
  showAiSuggestion?: boolean;
  aiSetup?: AISuggestedSetup | null;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressTapRef = useRef(false);
  const [placementMode, setPlacementMode] = useState<PlacementMode>("path");
  const [, forceRender] = useState(0);

  const latest = shots[shots.length - 1] ?? null;
  const visualShot = resultShot ?? editableShot ?? latest;
  const visualPath = visualShot ? pathForShot(visualShot) : "";
  const standingPins = useMemo(() => visualShot ? parseLeave(visualShot.leave_code, visualShot.pinfall) : ALL_PINS, [visualShot]);

  function applyWholePathShift(deltaBoards: number, initial: Pick<ShotInput, EditableField>) {
    if (!onEditShot) return;
    const fields: EditableField[] = ["feet_board", "laydown_board", "target_board", "breakpoint_board", "pocket_board"];
    const minDelta = Math.max(...fields.map((field) => 1 - initial[field]));
    const maxDelta = Math.min(...fields.map((field) => 39 - initial[field]));
    const safe = clamp(roundTo(deltaBoards, 0.5), minDelta, maxDelta);
    onEditShot({
      feet_board: clamp(roundTo(initial.feet_board + safe, 0.5), 1, 39),
      laydown_board: clamp(roundTo(initial.laydown_board + safe, 0.5), 1, 39),
      target_board: clamp(roundTo(initial.target_board + safe, 0.5), 1, 39),
      breakpoint_board: clamp(roundTo(initial.breakpoint_board + safe, 0.5), 1, 39),
      pocket_board: clamp(roundTo(initial.pocket_board + safe, 0.25), 1, 39),
    });
  }

  function capture(pointerId: number) {
    try { svgRef.current?.setPointerCapture(pointerId); } catch { /* unavailable in some browsers */ }
  }

  function startFieldDrag(field: EditableField, event: React.PointerEvent<SVGGElement>) {
    if (!editMode || !onEditShot || resultShot) return;
    event.preventDefault();
    event.stopPropagation();
    capture(event.pointerId);
    suppressTapRef.current = true;
    dragRef.current = { type: "field", field, pointerId: event.pointerId };
    forceRender((value) => value + 1);
  }

  function startPathDrag(event: React.PointerEvent<SVGPathElement>) {
    if (!editMode || !svgRef.current || !editableShot || !onEditShot || resultShot) return;
    event.preventDefault();
    event.stopPropagation();
    capture(event.pointerId);
    suppressTapRef.current = true;
    const point = pointerToSvg(svgRef.current, event.clientX, event.clientY);
    dragRef.current = {
      type: "path",
      pointerId: event.pointerId,
      startX: point.x,
      initial: {
        feet_board: editableShot.feet_board,
        laydown_board: editableShot.laydown_board,
        target_board: editableShot.target_board,
        breakpoint_board: editableShot.breakpoint_board,
        pocket_board: editableShot.pocket_board,
      },
    };
    forceRender((value) => value + 1);
  }

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!svgRef.current || !drag || !onEditShot || drag.pointerId !== event.pointerId) return;
    const point = pointerToSvg(svgRef.current, event.clientX, event.clientY);
    if (drag.type === "field") {
      const step = drag.field === "pocket_board" ? 0.25 : 0.5;
      const patch: Partial<ShotInput> = { [drag.field]: boardForSvgX(point.x, step) } as Partial<ShotInput>;
      if (drag.field === "feet_board") patch.feet_depth_ft = feetDepthForSvgY(point.y);
      onEditShot(patch);
      return;
    }
    applyWholePathShift(boardForSvgX(point.x, 0.5) - boardForSvgX(drag.startX, 0.5), drag.initial);
  }

  function stopDrag(event: React.PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    try { svgRef.current?.releasePointerCapture(event.pointerId); } catch { /* no-op */ }
    dragRef.current = null;
    suppressTapRef.current = true;
    forceRender((value) => value + 1);
  }

  function handleTap(event: React.MouseEvent<SVGSVGElement>) {
    if (suppressTapRef.current) {
      suppressTapRef.current = false;
      return;
    }
    if (!editMode || !svgRef.current || !editableShot || !onEditShot || resultShot) return;
    const point = pointerToSvg(svgRef.current, event.clientX, event.clientY);
    if (placementMode === "path") {
      const center = (editableShot.feet_board + editableShot.laydown_board + editableShot.target_board + editableShot.breakpoint_board + editableShot.pocket_board) / 5;
      applyWholePathShift(boardForSvgX(point.x, 0.5) - center, {
        feet_board: editableShot.feet_board,
        laydown_board: editableShot.laydown_board,
        target_board: editableShot.target_board,
        breakpoint_board: editableShot.breakpoint_board,
        pocket_board: editableShot.pocket_board,
      });
      return;
    }
    const patch: Partial<ShotInput> = { [placementMode]: boardForSvgX(point.x, placementMode === "pocket_board" ? 0.25 : 0.5) } as Partial<ShotInput>;
    if (placementMode === "feet_board") patch.feet_depth_ft = feetDepthForSvgY(point.y);
    onEditShot(patch);
  }

  const handShort = handedness === "left" ? "LH" : "RH";
  const editing = editMode && !resultShot;

  return (
    <div className="lane-wrap">
      {editing && (
        <div className="lane-interaction-toolbar" role="toolbar" aria-label="Choose what to move">
          {placementOptions.map((option) => (
            <button key={option.key} type="button" className={placementMode === option.key ? "active" : ""} onClick={() => setPlacementMode(option.key)}>{option.label}</button>
          ))}
        </div>
      )}

      <div className="handedness-banner"><strong>{handLabel(handedness)} view</strong><span>Board 1 starts at your bowling-hand gutter.</span></div>

      <svg
        ref={svgRef}
        className={`lane-svg ${editing ? "interactive" : ""}`}
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        role="img"
        aria-label={`${handLabel(handedness)} bowling lane`}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
        onClick={handleTap}
      >
        <defs>
          <pattern id="laneBoardPattern" width={BOARD_GAP * 2} height="160" patternUnits="userSpaceOnUse">
            <rect width={BOARD_GAP} height="160" fill="#e0b06d" />
            <rect x={BOARD_GAP} width={BOARD_GAP} height="160" fill="#c99150" />
            <path d={`M ${BOARD_GAP} 0 V 160 M ${BOARD_GAP * 2} 0 V 160`} stroke="#6e431d" strokeOpacity=".28" strokeWidth=".7" />
            <path d={`M 0 80 H ${BOARD_GAP} M ${BOARD_GAP} 120 H ${BOARD_GAP * 2}`} stroke="#8c5b2e" strokeOpacity=".18" strokeWidth="1" />
          </pattern>
          <linearGradient id="laneLengthTone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff6d2" stopOpacity=".14" />
            <stop offset=".18" stopColor="#fff" stopOpacity=".02" />
            <stop offset=".55" stopColor="#6e3b13" stopOpacity=".05" />
            <stop offset="1" stopColor="#261004" stopOpacity=".16" />
          </linearGradient>
          <linearGradient id="approachTone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e4b16d" />
            <stop offset="1" stopColor="#b9783e" />
          </linearGradient>
          <linearGradient id="gutterTone" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#0a1118" />
            <stop offset=".45" stopColor="#32404a" />
            <stop offset=".65" stopColor="#111b23" />
            <stop offset="1" stopColor="#05090d" />
          </linearGradient>
          <linearGradient id="oilSheen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#dcffff" stopOpacity=".16" />
            <stop offset=".55" stopColor="#63dff2" stopOpacity=".06" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <filter id="laneShadow" x="-30%" y="-10%" width="160%" height="130%"><feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#000" floodOpacity=".42" /></filter>
          <filter id="lineGlow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>

        <rect x="4" y="42" width="612" height="888" rx="22" fill="#050d17" stroke="#18324a" strokeWidth="2"/>
        <g filter="url(#laneShadow)">
          <rect x={LANE_LEFT - 38} y={LANE_TOP - 6} width="30" height={LANE_LENGTH + 12} rx="13" fill="url(#gutterTone)"/>
          <rect x={LANE_LEFT + LANE_WIDTH + 8} y={LANE_TOP - 6} width="30" height={LANE_LENGTH + 12} rx="13" fill="url(#gutterTone)"/>
          <rect x={LANE_LEFT - 8} y={LANE_TOP} width="8" height={LANE_LENGTH} fill="#252d32"/>
          <rect x={LANE_LEFT + LANE_WIDTH} y={LANE_TOP} width="8" height={LANE_LENGTH} fill="#252d32"/>
          <rect x={LANE_LEFT} y={LANE_TOP} width={LANE_WIDTH} height={LANE_LENGTH} rx="4" fill="url(#laneBoardPattern)"/>
          <rect x={LANE_LEFT} y={LANE_TOP} width={LANE_WIDTH} height={LANE_LENGTH} rx="4" fill="url(#laneLengthTone)"/>
          <rect x={LANE_LEFT} y={LANE_TOP + 18} width={LANE_WIDTH} height={Math.round(LANE_LENGTH * .67)} fill="url(#oilSheen)"/>
          <rect x={LANE_LEFT} y={FOUL_LINE_Y} width={LANE_WIDTH} height={APPROACH_BOTTOM - FOUL_LINE_Y} fill="url(#approachTone)"/>
          <rect x={LANE_LEFT} y={FOUL_LINE_Y} width={LANE_WIDTH} height={APPROACH_BOTTOM - FOUL_LINE_Y} fill="url(#laneBoardPattern)" opacity=".42"/>
        </g>

        {Array.from({ length: 39 }).map((_, index) => {
          const x = LANE_LEFT + BOARD_GAP * index;
          return <line key={index} x1={x} y1={LANE_TOP} x2={x} y2={APPROACH_BOTTOM} stroke="#5e3a1b" strokeOpacity={index % 5 === 0 ? ".34" : ".16"} strokeWidth={index % 5 === 0 ? 1 : .55}/>;
        })}
        {[120, 205, 292, 382, 468, 552].map((offset, index) => (
          <line key={`joint-${index}`} x1={LANE_LEFT} y1={LANE_TOP + offset} x2={LANE_LEFT + LANE_WIDTH} y2={LANE_TOP + offset} stroke="#855329" strokeOpacity=".10" strokeWidth="1"/>
        ))}

        <rect x={LANE_LEFT} y={FOUL_LINE_Y - 5} width={LANE_WIDTH} height="10" fill="#f2f5f4" stroke="#d6dbdb" strokeWidth="1"/>
        <rect x={LANE_LEFT} y={LANE_TOP} width={LANE_WIDTH} height="76" fill="#f6d69b" opacity=".24"/>
        {[3,7,11,15,20,25,29,33,37].map((board) => <circle key={`lane-dot-${board}`} cx={xForBoard(board)} cy={yForDistance(7.5)} r="2.8" fill="#283039"/>)}
        {[5,10,15,20,25,30,35].map((board) => { const x=xForBoard(board), y=yForDistance(15); return <path key={`arrow-${board}`} d={`M ${x} ${y-9} l 7.5 16 h -15 z`} fill="#2f3438" opacity=".96"/>; })}

        <text x={LANE_LEFT - 14} y={yForDistance(15)+4} textAnchor="end" fill="#78dce9" fontSize="10" fontWeight="800">ARROWS</text>
        <text x={LANE_LEFT - 14} y={FOUL_LINE_Y+4} textAnchor="end" fill="#d8e8ef" fontSize="10" fontWeight="800">FOUL</text>
        <text x={VIEW_WIDTH/2} y={LANE_TOP-9} textAnchor="middle" fill="#dbeef5" fontSize="11" fontWeight="900">PIN DECK</text>

        {MAJOR_PHYSICAL_BOARDS.map((physical) => <g key={`board-${physical}`}><text x={xForBoard(physical)} y={FOUL_LINE_Y+25} textAnchor="middle" fill="#f6fbff" fontSize="16" fontWeight="900">{formatBoard(toDisplayBoard(physical, handedness))}</text><text x={xForBoard(physical)} y={FOUL_LINE_Y+40} textAnchor="middle" fill="#7e9aaa" fontSize="8" fontWeight="800">{handShort}</text></g>)}

        {APPROACH_DOT_BOARDS.map((physical) => <g key={`approach-${physical}`}><circle cx={xForBoard(physical)} cy={yForFeetDepth(6)} r="4.2" fill="#2b1608" stroke="#efc98d" strokeWidth=".8"/><circle cx={xForBoard(physical)} cy={yForFeetDepth(12)} r="4.2" fill="#2b1608" stroke="#efc98d" strokeWidth=".8"/><text x={xForBoard(physical)} y={APPROACH_BOTTOM-8} textAnchor="middle" fill="#f4fbff" fontSize="13" fontWeight="900">{formatBoard(toDisplayBoard(physical, handedness))}</text></g>)}
        <text x={LANE_LEFT-14} y={yForFeetDepth(6)+4} textAnchor="end" fill="#8fa8b7" fontSize="9" fontWeight="700">6 FT</text>
        <text x={LANE_LEFT-14} y={yForFeetDepth(12)+4} textAnchor="end" fill="#8fa8b7" fontSize="9" fontWeight="700">12 FT</text>

        {Object.entries(pinPositions).map(([pin, position]) => {
          const pinNumber = Number(pin);
          return <circle key={`spot-${pin}`} cx={VIEW_WIDTH/2 + position.x*15} cy={LANE_TOP+10+position.y+4} r="5" fill="#af6b3c" opacity=".32"/>;
        })}

        {Object.entries(pinPositions).map(([pin, position]) => {
          const pinNumber = Number(pin);
          return <Pin key={`${pin}-${resultShot?.id ?? "preview"}`} x={VIEW_WIDTH/2 + position.x*15} y={LANE_TOP+10+position.y} standing={standingPins.includes(pinNumber)} impact={!!resultShot} pinNumber={pinNumber}/>;
        })}

        {showAiSuggestion && aiSetup && !resultShot && <AISuggestionOverlay setup={aiSetup} handedness={handedness}/>} 

        {visualPath && <>
          <path id="currentBallPath" d={visualPath} fill="none" stroke="transparent"/>
          {editing && <path className="path-drag-hitbox" d={visualPath} fill="none" stroke="transparent" strokeWidth="32" onPointerDown={startPathDrag}/>} 
          <path d={visualPath} fill="none" stroke="#00f3ff" strokeOpacity=".18" strokeWidth="9" filter="url(#lineGlow)" strokeLinecap="round"/>
          <path d={visualPath} fill="none" stroke="#8affff" strokeWidth="4" strokeLinecap="round" strokeDasharray={resultShot ? "700" : undefined} strokeDashoffset={resultShot ? "700" : undefined}>{resultShot && <animate attributeName="stroke-dashoffset" from="700" to="0" dur=".78s" fill="freeze"/>}</path>
          {resultShot && <g><circle cx="0" cy="0" r="7" fill="#00eaff" stroke="#fff" strokeWidth="2"/><animateMotion dur=".82s" fill="freeze" rotate="auto"><mpath href="#currentBallPath"/></animateMotion></g>}
        </>}

        {visualShot && !resultShot && (editing ? <>
          <EditMarker field="feet_board" board={visualShot.feet_board} pointY={yForFeetDepth(visualShot.feet_depth_ft || 11.5)} handedness={handedness} active={placementMode === "feet_board"} onPointerDown={(event) => startFieldDrag("feet_board", event)}/>
          <EditMarker field="laydown_board" board={visualShot.laydown_board} pointY={yForDistance(1.5)} handedness={handedness} active={placementMode === "laydown_board"} onPointerDown={(event) => startFieldDrag("laydown_board", event)}/>
          <EditMarker field="target_board" board={visualShot.target_board} pointY={yForDistance(15)} handedness={handedness} active={placementMode === "target_board"} onPointerDown={(event) => startFieldDrag("target_board", event)}/>
          <EditMarker field="breakpoint_board" board={visualShot.breakpoint_board} pointY={yForDistance(44)} handedness={handedness} active={placementMode === "breakpoint_board"} onPointerDown={(event) => startFieldDrag("breakpoint_board", event)}/>
          <EditMarker field="pocket_board" board={visualShot.pocket_board} pointY={yForDistance(59)} handedness={handedness} active={placementMode === "pocket_board"} onPointerDown={(event) => startFieldDrag("pocket_board", event)}/>
        </> : <>
          <SimplePoint x={xForBoard(visualShot.feet_board)} y={yForFeetDepth(visualShot.feet_depth_ft || 11.5)} color="#8affff" ring/>
          <SimplePoint x={xForBoard(visualShot.laydown_board)} y={yForDistance(1.5)} color="#8affff" ring/>
          <SimplePoint x={xForBoard(visualShot.target_board)} y={yForDistance(15)} color="#00f5ff"/>
          <SimplePoint x={xForBoard(visualShot.breakpoint_board)} y={yForDistance(44)} color="#ffc663"/>
          <SimplePoint x={xForBoard(visualShot.pocket_board)} y={yForDistance(59)} color="#fff"/>
        </>)}

        <text x={VIEW_WIDTH/2} y="30" textAnchor="middle" fill="#8defff" fontSize="13" fontWeight="900" letterSpacing=".14em">{handLabel(handedness).toUpperCase()} LANE</text>
        <text x={VIEW_WIDTH/2} y={VIEW_HEIGHT-20} textAnchor="middle" fill="#607c90" fontSize="10">Board numbers follow your profile. Tap “Edit line” for detailed controls.</text>
      </svg>

      {visualShot && (
        <div className="simple-line-summary" aria-label="Current shot setup">
          <span><small>Feet</small><b>{formatBoard(toDisplayBoard(visualShot.feet_board, handedness))} at {(visualShot.feet_depth_ft || 11.5).toFixed(1)} ft</b></span>
          <span><small>Target</small><b>{formatBoard(toDisplayBoard(visualShot.target_board, handedness))}</b></span>
          <span><small>Breakpoint</small><b>{formatBoard(toDisplayBoard(visualShot.breakpoint_board, handedness))}</b></span>
          <span><small>Speed</small><b>{visualShot.speed_mph ? `${visualShot.speed_mph.toFixed(1)} mph` : "Not entered"}</b></span>
        </div>
      )}
    </div>
  );
}
