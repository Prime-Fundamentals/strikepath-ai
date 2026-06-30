"use client";

import { useMemo, useRef, useState } from "react";
import type { Handedness, LaneState, Recommendation, Shot, ShotInput } from "@/lib/types";
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

function boardForSvgX(x: number, step: number) {
  const ratio = clamp((x - LANE_LEFT) / LANE_WIDTH, 0, 1);
  return clamp(roundTo(39 - ratio * 38, step), 1, 39);
}

function clientXToSvgX(svg: SVGSVGElement, clientX: number) {
  const rect = svg.getBoundingClientRect();
  return ((clientX - rect.left) / rect.width) * VIEW_WIDTH;
}

function pathForShot(shotLike: Pick<ShotInput, "laydown_board" | "target_board" | "breakpoint_board" | "pocket_board">) {
  return `M ${xForBoard(shotLike.laydown_board)} ${yForDistance(1.5)} C ${xForBoard(shotLike.target_board)} ${yForDistance(15)} ${xForBoard(shotLike.breakpoint_board)} ${yForDistance(44)} ${xForBoard(shotLike.pocket_board)} ${yForDistance(59)}`;
}

// Viewed from the bowler: the head pin is nearest the foul line (largest y).
const pinPositions = {
  7: { x: -3, y: 0 }, 8: { x: -1, y: 0 }, 9: { x: 1, y: 0 }, 10: { x: 3, y: 0 },
  4: { x: -2, y: 18 }, 5: { x: 0, y: 18 }, 6: { x: 2, y: 18 },
  2: { x: -1, y: 36 }, 3: { x: 1, y: 36 },
  1: { x: 0, y: 54 },
} as const;

function Pin({ x, y, standing, impact, pinNumber }: { x: number; y: number; standing: boolean; impact: boolean; pinNumber: number }) {
  return (
    <g transform={`translate(${x} ${y})`} opacity={standing ? 1 : .18}>
      {impact && <animate attributeName="opacity" values={standing ? ".3;1;.82;1" : "1;.48;.18"} dur=".7s" fill="freeze" />}
      <ellipse cx="0" cy="15" rx="7.6" ry="3" fill="rgba(0,0,0,.22)" />
      <path d="M0-12C-4.8-12-7.2-8.4-6.1-3.9C-5.1 0-5.2 2.9-6.7 6.2C-8.5 10.1-5.2 15.2 0 15.2C5.2 15.2 8.5 10.1 6.7 6.2C5.2 2.9 5.1 0 6.1-3.9C7.2-8.4 4.8-12 0-12Z" fill={standing ? "#fff" : "#7c8e9b"} stroke={standing ? "#bdd9e8" : "#627380"} strokeWidth="1.2" />
      <rect x="-1.4" y="-17" width="2.8" height="6" rx="1.4" fill="#ed3d50" />
      <text x="0" y="5" textAnchor="middle" fill={standing ? "#07141d" : "#465762"} fontSize="8" fontWeight="900">{pinNumber}</text>
    </g>
  );
}

const markerLayout: Record<EditableField, { label: string; side: "left" | "right"; labelY: number; color: string; fill: string }> = {
  feet_board: { label: "Feet", side: "left", labelY: APPROACH_BOTTOM - 32, color: "#65ecff", fill: "#071827" },
  laydown_board: { label: "Laydown", side: "right", labelY: FOUL_LINE_Y - 12, color: "#7fe8ff", fill: "#071827" },
  target_board: { label: "Target", side: "left", labelY: yForDistance(15) - 10, color: "#00f5ff", fill: "#00dce8" },
  breakpoint_board: { label: "Breakpoint", side: "right", labelY: yForDistance(44) - 10, color: "#ffc663", fill: "#ffc663" },
  pocket_board: { label: "Pocket", side: "left", labelY: LANE_TOP + 105, color: "#8cf8ff", fill: "#fff" },
};

function Marker({ field, board, pointY, handedness, active, enabled, onPointerDown }: {
  field: EditableField;
  board: number;
  pointY: number;
  handedness: Handedness;
  active: boolean;
  enabled: boolean;
  onPointerDown: (event: React.PointerEvent<SVGGElement>) => void;
}) {
  const layout = markerLayout[field];
  const pointX = xForBoard(board);
  const rectX = layout.side === "left" ? 12 : VIEW_WIDTH - 118;
  const width = 106;
  const lineX = layout.side === "left" ? rectX + width : rectX;
  const textX = layout.side === "left" ? rectX + 10 : rectX + width - 10;
  const anchor = layout.side === "left" ? "start" : "end";
  const display = formatBoard(toDisplayBoard(board, handedness));

  return (
    <g className={`lane-marker ${enabled ? "interactive" : ""} ${active ? "active" : ""}`} onPointerDown={enabled ? onPointerDown : undefined}>
      <path d={`M ${pointX} ${pointY} L ${lineX} ${layout.labelY + 12}`} fill="none" stroke={layout.color} strokeWidth="1.2" strokeDasharray="4 4" opacity=".68" />
      <circle cx={pointX} cy={pointY} r={active ? 9 : 8} fill={layout.fill} stroke={field === "pocket_board" ? "#00e9ff" : "#fff"} strokeWidth={active ? 3 : 2} />
      <rect x={rectX} y={layout.labelY} width={width} height="25" rx="12.5" fill="rgba(5,18,29,.97)" stroke={layout.color} strokeWidth={active ? 1.8 : 1} />
      <text x={textX} y={layout.labelY + 17} textAnchor={anchor} fill="#ecfbff" fontSize="10.5" fontWeight="800">{layout.label} {display}</text>
    </g>
  );
}

function SuggestionGhost({ feetBoard, targetBoard, breakpointBoard, pocketBoard }: { feetBoard: number; targetBoard: number; breakpointBoard: number; pocketBoard: number }) {
  const path = pathForShot({ laydown_board: feetBoard, target_board: targetBoard, breakpoint_board: breakpointBoard, pocket_board: pocketBoard });
  return <g><path d={path} fill="none" stroke="#8cdfff" strokeWidth="2.2" strokeDasharray="8 8" opacity=".56" /><circle cx={xForBoard(feetBoard)} cy={FOUL_LINE_Y + 108} r="6" fill="rgba(140,223,255,.12)" stroke="#8cdfff" strokeWidth="1.6" /><circle cx={xForBoard(targetBoard)} cy={yForDistance(15)} r="6" fill="rgba(140,223,255,.12)" stroke="#8cdfff" strokeWidth="1.6" /></g>;
}

const placementOptions: Array<{ key: PlacementMode; label: string }> = [
  { key: "path", label: "Whole path" }, { key: "feet_board", label: "Feet" }, { key: "laydown_board", label: "Laydown" }, { key: "target_board", label: "Target" }, { key: "breakpoint_board", label: "Breakpoint" }, { key: "pocket_board", label: "Pocket" },
];

export function LaneCanvas({ shots, laneState, editableShot, onEditShot, recommendation, resultShot = null, handedness }: {
  shots: Shot[];
  laneState: LaneState | null;
  editableShot?: ShotInput | null;
  onEditShot?: (patch: Partial<ShotInput>) => void;
  recommendation?: Recommendation | null;
  resultShot?: Shot | null;
  handedness: Handedness;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressTapRef = useRef(false);
  const [placementMode, setPlacementMode] = useState<PlacementMode>("path");
  const [, forceRender] = useState(0);

  const latestRealShot = shots[shots.length - 1] ?? null;
  const visualShot = resultShot ?? editableShot ?? latestRealShot;
  const visualPath = visualShot ? pathForShot(visualShot) : "";
  const standingPins = useMemo(() => visualShot ? parseLeave(visualShot.leave_code, visualShot.pinfall) : ALL_PINS, [visualShot]);
  const recommendationPreview = latestRealShot && recommendation ? {
    feetBoard: clamp(latestRealShot.feet_board + recommendation.feet_delta, 1, 39),
    targetBoard: clamp(latestRealShot.target_board + recommendation.target_delta, 1, 39),
    breakpointBoard: latestRealShot.breakpoint_board,
    pocketBoard: latestRealShot.pocket_board,
  } : null;

  function applyWholePathShift(deltaBoards: number, initial: Pick<ShotInput, EditableField>) {
    if (!onEditShot) return;
    const fields: EditableField[] = ["feet_board", "laydown_board", "target_board", "breakpoint_board", "pocket_board"];
    const minDelta = Math.max(...fields.map((field) => 1 - initial[field]));
    const maxDelta = Math.min(...fields.map((field) => 39 - initial[field]));
    const safe = clamp(roundTo(deltaBoards, .5), minDelta, maxDelta);
    onEditShot({
      feet_board: clamp(roundTo(initial.feet_board + safe, .5), 1, 39),
      laydown_board: clamp(roundTo(initial.laydown_board + safe, .5), 1, 39),
      target_board: clamp(roundTo(initial.target_board + safe, .5), 1, 39),
      breakpoint_board: clamp(roundTo(initial.breakpoint_board + safe, .5), 1, 39),
      pocket_board: clamp(roundTo(initial.pocket_board + safe, .25), 1, 39),
    });
  }

  function beginCapture(pointerId: number) {
    try { svgRef.current?.setPointerCapture(pointerId); } catch { /* optional browser capability */ }
  }

  function startFieldDrag(field: EditableField, event: React.PointerEvent<SVGGElement>) {
    if (!onEditShot || resultShot) return;
    event.preventDefault(); event.stopPropagation(); beginCapture(event.pointerId); suppressTapRef.current = true;
    dragRef.current = { type: "field", field, pointerId: event.pointerId }; forceRender((value) => value + 1);
  }

  function startPathDrag(event: React.PointerEvent<SVGPathElement>) {
    if (!svgRef.current || !editableShot || !onEditShot || resultShot) return;
    event.preventDefault(); event.stopPropagation(); beginCapture(event.pointerId); suppressTapRef.current = true;
    dragRef.current = { type: "path", pointerId: event.pointerId, startX: clientXToSvgX(svgRef.current, event.clientX), initial: {
      feet_board: editableShot.feet_board, laydown_board: editableShot.laydown_board, target_board: editableShot.target_board, breakpoint_board: editableShot.breakpoint_board, pocket_board: editableShot.pocket_board,
    }};
    forceRender((value) => value + 1);
  }

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!svgRef.current || !drag || !onEditShot || drag.pointerId !== event.pointerId) return;
    const svgX = clientXToSvgX(svgRef.current, event.clientX);
    if (drag.type === "field") {
      const step = drag.field === "pocket_board" ? .25 : .5;
      onEditShot({ [drag.field]: boardForSvgX(svgX, step) } as Partial<ShotInput>);
    } else {
      applyWholePathShift(boardForSvgX(svgX, .5) - boardForSvgX(drag.startX, .5), drag.initial);
    }
  }

  function stopDrag(event: React.PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    suppressTapRef.current = true;
    try { svgRef.current?.releasePointerCapture(event.pointerId); } catch { /* no-op */ }
    dragRef.current = null; forceRender((value) => value + 1);
  }

  function handleLaneTap(event: React.MouseEvent<SVGSVGElement>) {
    if (suppressTapRef.current) { suppressTapRef.current = false; return; }
    if (!svgRef.current || !onEditShot || !editableShot || resultShot) return;
    const svgX = clientXToSvgX(svgRef.current, event.clientX);
    if (placementMode === "path") {
      const center = (editableShot.feet_board + editableShot.laydown_board + editableShot.target_board + editableShot.breakpoint_board + editableShot.pocket_board) / 5;
      applyWholePathShift(boardForSvgX(svgX, .5) - center, editableShot);
      return;
    }
    onEditShot({ [placementMode]: boardForSvgX(svgX, placementMode === "pocket_board" ? .25 : .5) } as Partial<ShotInput>);
  }

  const drag = dragRef.current;
  const handShort = handedness === "left" ? "LH" : "RH";

  return (
    <div className="lane-wrap">
      {onEditShot && <div className="lane-interaction-toolbar" role="toolbar" aria-label="Lane marker placement mode">{placementOptions.map((option) => <button key={option.key} type="button" className={placementMode === option.key ? "active" : ""} onClick={() => setPlacementMode(option.key)}>{option.label}</button>)}</div>}

      <div className="lane-hand-banner"><strong>{handLabel(handedness)} view</strong><span>Board 1 starts at your bowling-hand gutter.</span></div>

      <svg ref={svgRef} className={`lane-svg ${onEditShot ? "interactive" : ""} ${drag ? "dragging" : ""}`} viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} role="img" aria-label={`${handLabel(handedness)} interactive bowling lane`} onPointerMove={handlePointerMove} onPointerUp={stopDrag} onPointerCancel={stopDrag} onClick={handleLaneTap}>
        <defs>
          <linearGradient id="laneWoodReadable" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#a76d3a"/><stop offset=".16" stopColor="#e2b57b"/><stop offset=".34" stopColor="#be8448"/><stop offset=".5" stopColor="#efc994"/><stop offset=".7" stopColor="#bd8348"/><stop offset=".86" stopColor="#e3b77d"/><stop offset="1" stopColor="#a96f3b"/></linearGradient>
          <linearGradient id="oilReadable" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8ffcff" stopOpacity=".2"/><stop offset=".62" stopColor="#00cbff" stopOpacity=".08"/><stop offset="1" stopColor="#00cbff" stopOpacity="0"/></linearGradient>
          <filter id="softGlowReadable" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>

        <rect x="4" y="42" width="612" height="888" rx="22" fill="#050d17" stroke="#18324a" strokeWidth="2"/>
        <rect x={LANE_LEFT - 28} y={LANE_TOP} width="20" height={LANE_LENGTH} rx="10" fill="#162431"/>
        <rect x={LANE_LEFT} y={LANE_TOP} width={LANE_WIDTH} height={LANE_LENGTH} rx="8" fill="url(#laneWoodReadable)"/>
        <rect x={LANE_LEFT} y={LANE_TOP + 10} width={LANE_WIDTH} height={Math.round(LANE_LENGTH * .7)} fill="url(#oilReadable)"/>
        <rect x={LANE_LEFT + LANE_WIDTH + 8} y={LANE_TOP} width="20" height={LANE_LENGTH} rx="10" fill="#162431"/>
        <rect x={LANE_LEFT} y={FOUL_LINE_Y} width={LANE_WIDTH} height={APPROACH_BOTTOM - FOUL_LINE_Y} fill="url(#laneWoodReadable)" opacity=".93"/>

        {Array.from({ length: 39 }).map((_, index) => { const x = LANE_LEFT + BOARD_GAP * index; return <line key={index} x1={x} y1={LANE_TOP} x2={x} y2={APPROACH_BOTTOM} stroke="#5e3a1b" strokeOpacity={index % 5 === 0 ? ".34" : ".13"} strokeWidth={index % 5 === 0 ? 1 : .55}/>; })}

        <rect x={LANE_LEFT} y={FOUL_LINE_Y - 4} width={LANE_WIDTH} height="8" fill="rgba(255,255,255,.78)"/>
        <line x1={LANE_LEFT} y1={yForDistance(15)} x2={LANE_LEFT + LANE_WIDTH} y2={yForDistance(15)} stroke="#0b6677" strokeOpacity=".38" strokeDasharray="6 6"/>
        <line x1={LANE_LEFT} y1={yForDistance(7.5)} x2={LANE_LEFT + LANE_WIDTH} y2={yForDistance(7.5)} stroke="#0b3141" strokeOpacity=".24" strokeDasharray="4 8"/>

        {[3,7,11,15,20,25,29,33,37].map((board) => <circle key={`lane-dot-${board}`} cx={xForBoard(board)} cy={yForDistance(7.5)} r="2.9" fill="#23343f" opacity=".9"/>)}
        {[5,10,15,20,25,30,35].map((board) => { const x=xForBoard(board), y=yForDistance(15); return <path key={`arrow-${board}`} d={`M ${x} ${y-8} l 7 15 h -14 z`} fill="#293844" opacity=".94"/>; })}

        <text x={LANE_LEFT - 14} y={yForDistance(15)+4} textAnchor="end" fill="#78dce9" fontSize="10" fontWeight="800">ARROWS</text>
        <text x={LANE_LEFT - 14} y={FOUL_LINE_Y+4} textAnchor="end" fill="#d8e8ef" fontSize="10" fontWeight="800">FOUL</text>
        <text x={VIEW_WIDTH/2} y={LANE_TOP-9} textAnchor="middle" fill="#dbeef5" fontSize="11" fontWeight="900">PIN DECK</text>

        {MAJOR_PHYSICAL_BOARDS.map((physical) => <g key={`board-${physical}`}><text x={xForBoard(physical)} y={FOUL_LINE_Y+25} textAnchor="middle" fill="#f6fbff" fontSize="16" fontWeight="900">{formatBoard(toDisplayBoard(physical, handedness))}</text><text x={xForBoard(physical)} y={FOUL_LINE_Y+40} textAnchor="middle" fill="#7e9aaa" fontSize="8" fontWeight="800">{handShort}</text></g>)}

        {APPROACH_DOT_BOARDS.map((physical) => <g key={`approach-${physical}`}><circle cx={xForBoard(physical)} cy={FOUL_LINE_Y+68} r="4" fill="#2a1a10"/><circle cx={xForBoard(physical)} cy={FOUL_LINE_Y+122} r="4" fill="#2a1a10"/><text x={xForBoard(physical)} y={FOUL_LINE_Y+150} textAnchor="middle" fill="#f4fbff" fontSize="13" fontWeight="900">{formatBoard(toDisplayBoard(physical, handedness))}</text></g>)}
        <text x={LANE_LEFT-14} y={FOUL_LINE_Y+72} textAnchor="end" fill="#8fa8b7" fontSize="9" fontWeight="700">NEAR DOTS</text>
        <text x={LANE_LEFT-14} y={FOUL_LINE_Y+126} textAnchor="end" fill="#8fa8b7" fontSize="9" fontWeight="700">BACK DOTS</text>
        <text x={VIEW_WIDTH/2} y={APPROACH_BOTTOM+20} textAnchor="middle" fill="#7c98a9" fontSize="10" fontWeight="800">APPROACH REFERENCE DOTS • VERIFY THE BACK ROW AT EACH CENTER</text>

        {Object.entries(pinPositions).map(([pin, position]) => { const pinNumber=Number(pin); return <Pin key={`${pin}-${resultShot?.id ?? "preview"}`} x={VIEW_WIDTH/2 + position.x*15} y={LANE_TOP+10+position.y} standing={standingPins.includes(pinNumber)} impact={!!resultShot} pinNumber={pinNumber}/>; })}
        {resultShot && <circle cx={xForBoard(resultShot.pocket_board)} cy={yForDistance(59)} r="8" fill="none" stroke="#fff" strokeWidth="2" opacity="0"><animate attributeName="r" values="8;34" dur=".55s" fill="freeze"/><animate attributeName="opacity" values=".8;0" dur=".55s" fill="freeze"/></circle>}

        {laneState?.paths.slice(-5,-1).map((item,index) => { const d=item.samples.map((sample,i)=>`${i===0?"M":"L"} ${xForBoard(sample.board)} ${yForDistance(sample.distance_ft)}`).join(" "); return <path key={item.shot_id} d={d} fill="none" stroke="#45b9d4" strokeOpacity={.12+index*.07} strokeWidth="2" strokeLinecap="round"/>; })}
        {recommendationPreview && !resultShot && <SuggestionGhost feetBoard={recommendationPreview.feetBoard} targetBoard={recommendationPreview.targetBoard} breakpointBoard={recommendationPreview.breakpointBoard} pocketBoard={recommendationPreview.pocketBoard}/>} 

        {visualPath && <><path id="readableBallPath" d={visualPath} fill="none" stroke="transparent"/>{onEditShot && !resultShot && <path className="path-drag-hitbox" d={visualPath} fill="none" stroke="transparent" strokeWidth="30" onPointerDown={startPathDrag}/>}<path d={visualPath} fill="none" stroke="#00f3ff" strokeOpacity=".2" strokeWidth="9" filter="url(#softGlowReadable)" strokeLinecap="round"/><path d={visualPath} fill="none" stroke="#8affff" strokeWidth="4" strokeLinecap="round" strokeDasharray={resultShot?"700":undefined} strokeDashoffset={resultShot?"700":undefined}>{resultShot && <animate attributeName="stroke-dashoffset" from="700" to="0" dur=".78s" fill="freeze"/>}</path>{!resultShot && <circle cx={xForBoard(visualShot!.laydown_board)} cy={yForDistance(1.5)} r="6.5" fill="#00eaff" stroke="#fff" strokeWidth="2"/>}{resultShot && <g><circle cx="0" cy="0" r="7" fill="#00eaff" stroke="#fff" strokeWidth="2"/><animateMotion dur=".82s" fill="freeze" rotate="auto"><mpath href="#readableBallPath"/></animateMotion></g>}</>}

        {visualShot && !resultShot && <><Marker field="feet_board" board={visualShot.feet_board} pointY={FOUL_LINE_Y+122} handedness={handedness} active={placementMode==="feet_board"} enabled={!!onEditShot} onPointerDown={(e)=>startFieldDrag("feet_board",e)}/><Marker field="laydown_board" board={visualShot.laydown_board} pointY={yForDistance(1.5)} handedness={handedness} active={placementMode==="laydown_board"} enabled={!!onEditShot} onPointerDown={(e)=>startFieldDrag("laydown_board",e)}/><Marker field="target_board" board={visualShot.target_board} pointY={yForDistance(15)} handedness={handedness} active={placementMode==="target_board"} enabled={!!onEditShot} onPointerDown={(e)=>startFieldDrag("target_board",e)}/><Marker field="breakpoint_board" board={visualShot.breakpoint_board} pointY={yForDistance(44)} handedness={handedness} active={placementMode==="breakpoint_board"} enabled={!!onEditShot} onPointerDown={(e)=>startFieldDrag("breakpoint_board",e)}/><Marker field="pocket_board" board={visualShot.pocket_board} pointY={yForDistance(59)} handedness={handedness} active={placementMode==="pocket_board"} enabled={!!onEditShot} onPointerDown={(e)=>startFieldDrag("pocket_board",e)}/></>}

        <text x={VIEW_WIDTH/2} y="30" textAnchor="middle" fill="#8defff" fontSize="13" fontWeight="900" letterSpacing=".14em">{handLabel(handedness).toUpperCase()} INTERACTIVE LANE</text>
        <text x={VIEW_WIDTH/2} y={VIEW_HEIGHT-20} textAnchor="middle" fill="#607c90" fontSize="10" letterSpacing=".07em">NUMBERS, DOTS, TARGETS, AND PATH ALL USE YOUR PROFILE HANDEDNESS</text>
      </svg>

      {recommendationPreview && recommendation && <div className="lane-recommendation-panel"><small>Recommended next move</small><strong>Feet {formatBoard(toDisplayBoard(recommendationPreview.feetBoard, handedness))} • Target {formatBoard(toDisplayBoard(recommendationPreview.targetBoard, handedness))}</strong><p>{recommendation.explanation}</p></div>}
      <div className="lane-legend"><span><i className="cyan"/>Target</span><span><i className="gold"/>Breakpoint</span><span><i className="white"/>Pocket</span><span><i className="ghost"/>Recommended line</span></div>
    </div>
  );
}
