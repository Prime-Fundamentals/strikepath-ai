"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Ball, Handedness, LaneState, Shot, ShotInput } from "@/lib/types";
import type { AISuggestedSetup } from "@/lib/aiSetup";
import { formatBoard, handLabel, toDisplayBoard } from "@/lib/boards";
import { parseLeave } from "./PinLeaveSelector";
import { simulateBallPath, type PhysicsSample } from "@/lib/physicsEngine";
import styles from "./LaneCanvas.module.css";

type EditableField = "feet_board" | "laydown_board" | "target_board" | "breakpoint_board" | "pocket_board";
type PlacementMode = EditableField | "path";
export type LaneSnapMode = "free" | "quarter" | "half" | "full";
type LaneDraft = Pick<ShotInput, EditableField | "feet_depth_ft">;
type PointerPoint = { x: number; y: number };
type DragState =
  | { type: "field"; field: EditableField; pointerId: number; initial: LaneDraft; start: PointerPoint; moved: boolean }
  | { type: "path"; pointerId: number; initial: LaneDraft; start: PointerPoint; moved: boolean };

const VIEW_WIDTH = 660;
const VIEW_HEIGHT = 1010;
const LANE_LEFT = 150;
const LANE_TOP = 72;
const LANE_WIDTH = 360;
const HEAD_PIN_Y = 152;
const FOUL_LINE_Y = 720;
const APPROACH_BOTTOM = 962;
const APPROACH_MAX_FT = 15;
const BOARD_GAP = LANE_WIDTH / 38;
const ALL_PINS = [1,2,3,4,5,6,7,8,9,10];
const MAJOR_BOARDS = [39,35,30,25,20,15,10,5,1];
const APPROACH_DOTS = [35,30,25,20,15,10,5];

const PIN_LAYOUT: Record<number, { board: number; row: number }> = {
  7:{board:35,row:0},8:{board:25,row:0},9:{board:15,row:0},10:{board:5,row:0},
  4:{board:30,row:1},5:{board:20,row:1},6:{board:10,row:1},
  2:{board:25,row:2},3:{board:15,row:2},1:{board:20,row:3},
};

function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)); }
function roundTo(value: number, step: number) { return Math.round(value / step) * step; }
function xForBoard(board: number) { return LANE_LEFT + ((39 - board) / 38) * LANE_WIDTH; }
function yForDistance(distanceFt: number) { return FOUL_LINE_Y - (distanceFt / 60) * (FOUL_LINE_Y - HEAD_PIN_Y); }
function yForFeetDepth(depthFt: number) { return FOUL_LINE_Y + (clamp(depthFt, .5, 15) / 15) * (APPROACH_BOTTOM - FOUL_LINE_Y); }
function boardForX(x: number) { return clamp(39 - ((x - LANE_LEFT) / LANE_WIDTH) * 38, 1, 39); }
function depthForY(y: number) { return clamp(((y - FOUL_LINE_Y) / (APPROACH_BOTTOM - FOUL_LINE_Y)) * APPROACH_MAX_FT, .5, 15); }
function pointerToSvg(svg: SVGSVGElement, clientX: number, clientY: number): PointerPoint {
  const rect = svg.getBoundingClientRect();
  return { x: ((clientX - rect.left) / rect.width) * VIEW_WIDTH, y: ((clientY - rect.top) / rect.height) * VIEW_HEIGHT };
}
function draftFromShot(shot: ShotInput | Shot): LaneDraft {
  return {
    feet_board: shot.feet_board,
    feet_depth_ft: shot.feet_depth_ft || 11.5,
    laydown_board: shot.laydown_board,
    target_board: shot.target_board,
    breakpoint_board: shot.breakpoint_board,
    pocket_board: shot.pocket_board,
  };
}
function snapStep(mode: LaneSnapMode, pocket = false) {
  if (mode === "free") return .05;
  if (mode === "quarter") return .25;
  if (mode === "half") return pocket ? .25 : .5;
  return 1;
}
function snapDraft(draft: LaneDraft, mode: LaneSnapMode): LaneDraft {
  const depthStep = mode === "free" ? .1 : mode === "quarter" ? .25 : mode === "half" ? .5 : 1;
  return {
    feet_board: clamp(roundTo(draft.feet_board, snapStep(mode)), 1, 39),
    feet_depth_ft: clamp(roundTo(draft.feet_depth_ft, depthStep), .5, 15),
    laydown_board: clamp(roundTo(draft.laydown_board, snapStep(mode)), 1, 39),
    target_board: clamp(roundTo(draft.target_board, snapStep(mode)), 1, 39),
    breakpoint_board: clamp(roundTo(draft.breakpoint_board, snapStep(mode)), 1, 39),
    pocket_board: clamp(roundTo(draft.pocket_board, snapStep(mode, true)), 1, 39),
  };
}
function pathFromSamples(samples: PhysicsSample[]) {
  return samples.map((sample, index) => `${index === 0 ? "M" : "L"} ${xForBoard(sample.board)} ${yForDistance(sample.distanceFt)}`).join(" ");
}
function sameDraft(a: LaneDraft, b: LaneDraft) {
  return (Object.keys(a) as Array<keyof LaneDraft>).every((key) => Math.abs(a[key] - b[key]) < .001);
}

function PinTop({ pin, standing, result }: { pin: number; standing: boolean; result: boolean }) {
  const info = PIN_LAYOUT[pin];
  const x = xForBoard(info.board);
  const y = 91 + info.row * 18;
  return (
    <g transform={`translate(${x} ${y})`} opacity={standing ? 1 : .17} pointerEvents="none">
      {result && <animate attributeName="opacity" values={standing ? ".3;1;.85;1" : "1;.4;.17"} dur=".55s" fill="freeze" />}
      <circle cx="1.5" cy="2.5" r="10" fill="rgba(0,0,0,.25)" />
      <circle r="8.5" fill={standing ? "#fff" : "#75848d"} stroke={standing ? "#dcecf3" : "#596872"} strokeWidth="1.3" />
      <circle r="5.2" fill="none" stroke={standing ? "#e74b58" : "#65727b"} strokeWidth="2.2" />
      <text y="2.7" textAnchor="middle" fill={standing ? "#0a1820" : "#45545e"} fontSize="6.5" fontWeight="900">{pin}</text>
    </g>
  );
}

const MARKERS: Record<EditableField, { label: string; color: string }> = {
  feet_board:{label:"Feet",color:"#72f8ff"},
  laydown_board:{label:"Laydown",color:"#72f8ff"},
  target_board:{label:"Target",color:"#00edf7"},
  breakpoint_board:{label:"Breakpoint",color:"#ffc66a"},
  pocket_board:{label:"Pocket",color:"#ffffff"},
};

function Marker({ field, board, y, handedness, active, onPointerDown }: { field: EditableField; board: number; y: number; handedness: Handedness; active: boolean; onPointerDown: (event: React.PointerEvent<SVGGElement>) => void }) {
  const info = MARKERS[field];
  const x = xForBoard(board);
  const width = field === "breakpoint_board" ? 112 : 96;
  const labelX = clamp(x - width / 2, LANE_LEFT + 3, LANE_LEFT + LANE_WIDTH - width - 3);
  const labelY = field === "feet_board" ? y + 14 : y - 34;
  return (
    <g className={styles.marker} onPointerDown={onPointerDown}>
      <circle cx={x} cy={y} r={active ? 10 : 8} fill={field === "pocket_board" ? "#fff" : field === "breakpoint_board" ? "#ffc66a" : "#08202d"} stroke={info.color} strokeWidth={active ? 3 : 2.3} />
      <rect x={labelX} y={labelY} width={width} height="24" rx="12" fill="rgba(4,15,24,.94)" stroke={info.color} strokeWidth={active ? 1.7 : 1} />
      <text x={labelX + width / 2} y={labelY + 16} textAnchor="middle" fill="#effcff" fontSize="10.5" fontWeight="850">
        {info.label} {formatBoard(toDisplayBoard(board, handedness))}
      </text>
    </g>
  );
}

function AIOverlay({ setup, handedness }: { setup: AISuggestedSetup; handedness: Handedness }) {
  const fakeShot = {
    laydown_board: setup.laydownBoard,
    target_board: setup.targetBoard,
    breakpoint_board: setup.breakpointBoard,
    pocket_board: setup.pocketBoard,
    speed_mph: setup.speedMph,
    rev_rate: null,
    axis_rotation: null,
    axis_tilt: null,
  };
  const physics = simulateBallPath({ shot: fakeShot, handedness, oilLengthFt: 41, ball: null });
  const path = pathFromSamples(physics.samples);
  const feetX = xForBoard(setup.feetBoard);
  const feetY = yForFeetDepth(setup.feetDepthFt);
  return (
    <g pointerEvents="none">
      <path d={`M ${feetX} ${feetY} L ${xForBoard(setup.laydownBoard)} ${yForDistance(1.5)}`} fill="none" stroke="#c999ff" strokeWidth="2.5" strokeDasharray="7 7" opacity=".78" />
      <path d={path} fill="none" stroke="#c999ff" strokeWidth="3" strokeDasharray="10 8" opacity=".88" />
      <circle cx={feetX} cy={feetY} r="8" fill="#241536" stroke="#d8b7ff" strokeWidth="2.5" />
      <circle cx={xForBoard(setup.targetBoard)} cy={yForDistance(15)} r="7" fill="#241536" stroke="#d8b7ff" strokeWidth="2.5" />
      <rect x={clamp(feetX - 53, LANE_LEFT, LANE_LEFT + LANE_WIDTH - 106)} y={feetY - 34} width="106" height="22" rx="11" fill="#241536" stroke="#c999ff" />
      <text x={clamp(feetX, LANE_LEFT + 53, LANE_LEFT + LANE_WIDTH - 53)} y={feetY - 19} textAnchor="middle" fill="#f3e8ff" fontSize="9.5" fontWeight="900">
        AI FEET {formatBoard(toDisplayBoard(setup.feetBoard, handedness))}
      </text>
    </g>
  );
}

const placementOptions: Array<{ key: PlacementMode; label: string }> = [
  {key:"path",label:"Move whole line"},
  {key:"feet_board",label:"Feet"},
  {key:"laydown_board",label:"Laydown"},
  {key:"target_board",label:"Target"},
  {key:"breakpoint_board",label:"Breakpoint"},
  {key:"pocket_board",label:"Pocket"},
];

export function OverheadLaneCanvas({
  shots,
  laneState: _laneState,
  editableShot,
  onEditShot,
  resultShot = null,
  handedness,
  editMode = false,
  showAiSuggestion = false,
  aiSetup = null,
  activeBall = null,
  oilLengthFt = 41,
  snapMode = "half",
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
  activeBall?: Ball | null;
  oilLengthFt?: number;
  snapMode?: LaneSnapMode;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);
  const pendingRef = useRef<PointerPoint | null>(null);
  const rafRef = useRef<number | null>(null);
  const [placementMode, setPlacementMode] = useState<PlacementMode>("path");
  const latest = shots[shots.length - 1] ?? null;
  const source = resultShot ?? editableShot ?? latest;
  const [preview, setPreview] = useState<LaneDraft | null>(source ? draftFromShot(source) : null);
  const id = useId().replace(/:/g, "_");

  useEffect(() => {
    if (!dragRef.current) setPreview(source ? draftFromShot(source) : null);
  }, [source?.feet_board, source?.feet_depth_ft, source?.laydown_board, source?.target_board, source?.breakpoint_board, source?.pocket_board]);

  useEffect(() => () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); }, []);

  const visual = preview && source ? { ...source, ...preview } : source;
  const physics = useMemo(() => visual ? simulateBallPath({ shot: visual, handedness, oilLengthFt, ball: activeBall }) : null, [visual, handedness, oilLengthFt, activeBall]);
  const path = physics ? pathFromSamples(physics.samples) : "";
  const standingPins = useMemo(() => source ? parseLeave(source.leave_code, source.pinfall) : ALL_PINS, [source?.leave_code, source?.pinfall]);

  function snapCurrent(next: LaneDraft) { return snapDraft(next, snapMode); }

  function shiftWhole(initial: LaneDraft, currentX: number, startX: number) {
    const delta = boardForX(currentX) - boardForX(startX);
    const fields: EditableField[] = ["feet_board","laydown_board","target_board","breakpoint_board","pocket_board"];
    const minDelta = Math.max(...fields.map((field) => 1 - initial[field]));
    const maxDelta = Math.min(...fields.map((field) => 39 - initial[field]));
    const safe = clamp(delta, minDelta, maxDelta);
    return { ...initial,
      feet_board: initial.feet_board + safe,
      laydown_board: initial.laydown_board + safe,
      target_board: initial.target_board + safe,
      breakpoint_board: initial.breakpoint_board + safe,
      pocket_board: initial.pocket_board + safe,
    };
  }

  function updatePreview(point: PointerPoint) {
    const drag = dragRef.current;
    if (!drag) return;
    drag.moved = true;
    if (drag.type === "path") {
      setPreview(shiftWhole(drag.initial, point.x, drag.start.x));
      return;
    }
    const next = { ...drag.initial };
    next[drag.field] = boardForX(point.x);
    if (drag.field === "feet_board") next.feet_depth_ft = depthForY(point.y);
    setPreview(next);
  }

  function schedulePreview(point: PointerPoint) {
    pendingRef.current = point;
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      if (pendingRef.current) updatePreview(pendingRef.current);
      pendingRef.current = null;
    });
  }

  function beginDrag(type: "path" | "field", event: React.PointerEvent<SVGElement>, field?: EditableField) {
    if (!editMode || !editableShot || !onEditShot || resultShot || !svgRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    const start = pointerToSvg(svgRef.current, event.clientX, event.clientY);
    const initial = preview ?? draftFromShot(editableShot);
    dragRef.current = type === "path"
      ? { type:"path", pointerId:event.pointerId, initial, start, moved:false }
      : { type:"field", field:field!, pointerId:event.pointerId, initial, start, moved:false };
    suppressClickRef.current = true;
    try { svgRef.current.setPointerCapture(event.pointerId); } catch { /* no-op */ }
  }

  function handleMove(event: React.PointerEvent<SVGSVGElement>) {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId || !svgRef.current) return;
    schedulePreview(pointerToSvg(svgRef.current, event.clientX, event.clientY));
  }

  function endDrag(event: React.PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      if (pendingRef.current) updatePreview(pendingRef.current);
      pendingRef.current = null;
    }
    const finalDraft = snapCurrent(preview ?? drag.initial);
    setPreview(finalDraft);
    if (drag.moved && !sameDraft(finalDraft, drag.initial)) onEditShot?.(finalDraft);
    try { svgRef.current?.releasePointerCapture(event.pointerId); } catch { /* no-op */ }
    dragRef.current = null;
    window.setTimeout(() => { suppressClickRef.current = false; }, 0);
  }

  function handleTap(event: React.MouseEvent<SVGSVGElement>) {
    if (suppressClickRef.current || !editMode || !editableShot || !onEditShot || resultShot || !svgRef.current) return;
    const point = pointerToSvg(svgRef.current, event.clientX, event.clientY);
    const initial = preview ?? draftFromShot(editableShot);
    let next = { ...initial };
    if (placementMode === "path") {
      const average = (initial.feet_board + initial.laydown_board + initial.target_board + initial.breakpoint_board + initial.pocket_board) / 5;
      next = shiftWhole(initial, point.x, xForBoard(average));
    } else {
      next[placementMode] = boardForX(point.x);
      if (placementMode === "feet_board") next.feet_depth_ft = depthForY(point.y);
    }
    next = snapCurrent(next);
    setPreview(next);
    onEditShot(next);
  }

  return (
    <div className={styles.overheadWrap}>
      {editMode && (
        <div className={styles.interactionToolbar} aria-label="Lane edit controls">
          {placementOptions.map((option) => (
            <button key={option.key} type="button" className={placementMode === option.key ? styles.active : ""} onClick={() => setPlacementMode(option.key)}>{option.label}</button>
          ))}
        </div>
      )}

      <svg
        ref={svgRef}
        className={`${styles.overheadSvg} ${editMode ? styles.editable : ""} ${dragRef.current ? styles.dragging : ""}`}
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        role="img"
        aria-label={`${handLabel(handedness)} overhead bowling lane`}
        onPointerMove={handleMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClick={handleTap}
      >
        <defs>
          <linearGradient id={`${id}_wood`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#b87e43" /><stop offset=".18" stopColor="#d9ad70" /><stop offset=".36" stopColor="#bd8449" /><stop offset=".55" stopColor="#e5bd80" /><stop offset=".75" stopColor="#c28a50" /><stop offset="1" stopColor="#d8a968" />
          </linearGradient>
          <linearGradient id={`${id}_approach`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#b7793f" /><stop offset=".5" stopColor="#d7a565" /><stop offset="1" stopColor="#b7793f" />
          </linearGradient>
          <linearGradient id={`${id}_oil`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#a5ffff" stopOpacity=".17" /><stop offset=".72" stopColor="#37c9e8" stopOpacity=".05" /><stop offset="1" stopColor="#37c9e8" stopOpacity="0" /></linearGradient>
          <linearGradient id={`${id}_gutter`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#071019" /><stop offset=".5" stopColor="#29333a" /><stop offset="1" stopColor="#070c11" /></linearGradient>
          <filter id={`${id}_glow`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>

        <rect x="18" y="38" width="624" height="944" rx="24" fill="#050d16" stroke="#1b3850" strokeWidth="2" />
        <text x={VIEW_WIDTH/2} y="25" textAnchor="middle" fill="#87f7ff" fontSize="14" fontWeight="900" letterSpacing=".13em">{handLabel(handedness).toUpperCase()} LANE</text>

        <rect x={LANE_LEFT - 29} y={LANE_TOP} width="22" height={FOUL_LINE_Y-LANE_TOP} rx="11" fill={`url(#${id}_gutter)`} />
        <rect x={LANE_LEFT + LANE_WIDTH + 7} y={LANE_TOP} width="22" height={FOUL_LINE_Y-LANE_TOP} rx="11" fill={`url(#${id}_gutter)`} />
        <rect x={LANE_LEFT} y={LANE_TOP} width={LANE_WIDTH} height={FOUL_LINE_Y-LANE_TOP} rx="7" fill={`url(#${id}_wood)`} />
        <rect x={LANE_LEFT} y={yForDistance(Math.min(oilLengthFt, 60))} width={LANE_WIDTH} height={Math.max(0, FOUL_LINE_Y - yForDistance(Math.min(oilLengthFt, 60)))} fill={`url(#${id}_oil)`} />
        <rect x={LANE_LEFT} y={FOUL_LINE_Y} width={LANE_WIDTH} height={APPROACH_BOTTOM-FOUL_LINE_Y} fill={`url(#${id}_approach)`} />

        {Array.from({length:39}).map((_, index) => {
          const x = LANE_LEFT + BOARD_GAP * index;
          return <line key={index} x1={x} y1={LANE_TOP} x2={x} y2={APPROACH_BOTTOM} stroke="#6f441f" strokeOpacity={index % 5 === 0 ? .28 : .12} strokeWidth={index % 5 === 0 ? 1 : .55} />;
        })}
        {Array.from({length:10}).map((_, row) => <line key={`joint-${row}`} x1={LANE_LEFT} y1={LANE_TOP+row*63} x2={LANE_LEFT+LANE_WIDTH} y2={LANE_TOP+row*63} stroke="#8d5d2e" strokeOpacity=".12" />)}

        <rect x={LANE_LEFT} y={FOUL_LINE_Y-5} width={LANE_WIDTH} height="10" fill="#f4f7f8" />
        <text x={LANE_LEFT-17} y={FOUL_LINE_Y+4} textAnchor="end" fill="#d8eff6" fontSize="10" fontWeight="900">FOUL</text>
        <text x={LANE_LEFT-17} y={yForDistance(15)+4} textAnchor="end" fill="#6eeeff" fontSize="10" fontWeight="900">ARROWS</text>
        <text x={VIEW_WIDTH/2} y="66" textAnchor="middle" fill="#e7f5f9" fontSize="10" fontWeight="850">PIN DECK</text>

        {[5,10,15,20,25,30,35].map((board) => {
          const x=xForBoard(board), y=yForDistance(15);
          return <path key={`arrow-${board}`} d={`M ${x} ${y-8} L ${x+8} ${y+8} L ${x-8} ${y+8} Z`} fill="#30383d" />;
        })}
        {[3,8,13,18,22,27,32,37].map((board) => <circle key={`dot-${board}`} cx={xForBoard(board)} cy={yForDistance(7)} r="3" fill="#303438" />)}

        {MAJOR_BOARDS.map((physical) => <text key={physical} x={xForBoard(physical)} y={FOUL_LINE_Y+28} textAnchor="middle" fill="#fff" fontSize="15" fontWeight="900">{formatBoard(toDisplayBoard(physical, handedness))}</text>)}
        {APPROACH_DOTS.map((physical) => <g key={`approach-${physical}`}>
          <circle cx={xForBoard(physical)} cy={yForFeetDepth(6)} r="4.5" fill="#2c1d11" stroke="#e1b97c" strokeWidth=".8" />
          <circle cx={xForBoard(physical)} cy={yForFeetDepth(12)} r="4.5" fill="#2c1d11" stroke="#e1b97c" strokeWidth=".8" />
          <text x={xForBoard(physical)} y={yForFeetDepth(12)+28} textAnchor="middle" fill="#fff" fontSize="12" fontWeight="850">{formatBoard(toDisplayBoard(physical, handedness))}</text>
        </g>)}
        <text x={LANE_LEFT-17} y={yForFeetDepth(6)+4} textAnchor="end" fill="#8ea8b7" fontSize="9" fontWeight="800">6 FT</text>
        <text x={LANE_LEFT-17} y={yForFeetDepth(12)+4} textAnchor="end" fill="#8ea8b7" fontSize="9" fontWeight="800">12 FT</text>

        {ALL_PINS.map((pin) => <PinTop key={`${pin}-${resultShot?.id ?? "preview"}`} pin={pin} standing={standingPins.includes(pin)} result={!!resultShot} />)}

        {showAiSuggestion && aiSetup && !resultShot && <AIOverlay setup={aiSetup} handedness={handedness} />}

        {path && <>
          <path id={`${id}_path`} d={path} fill="none" stroke="transparent" />
          {editMode && placementMode === "path" && !resultShot && <path className={styles.pathHitbox} d={path} fill="none" stroke="transparent" strokeWidth="28" onPointerDown={(event) => beginDrag("path", event)} />}
          <path d={path} fill="none" stroke="#74f8ff" strokeOpacity=".18" strokeWidth="11" strokeLinecap="round" filter={`url(#${id}_glow)`} pointerEvents="none" />
          <path d={path} fill="none" stroke="#8fffff" strokeWidth="4" strokeLinecap="round" pointerEvents="none" />
          {resultShot && <g><circle r="7" fill="#00eaff" stroke="#fff" strokeWidth="2" /><animateMotion dur=".72s" fill="freeze"><mpath href={`#${id}_path`} /></animateMotion></g>}
        </>}

        {preview && <path d={`M ${xForBoard(preview.feet_board)} ${yForFeetDepth(preview.feet_depth_ft)} L ${xForBoard(preview.laydown_board)} ${yForDistance(1.5)}`} fill="none" stroke="#78f7ff" strokeWidth="2" strokeDasharray="5 6" opacity=".45" pointerEvents="none" />}

        {editMode && preview && !resultShot && <>
          <Marker field="feet_board" board={preview.feet_board} y={yForFeetDepth(preview.feet_depth_ft)} handedness={handedness} active={placementMode === "feet_board"} onPointerDown={(event) => beginDrag("field", event, "feet_board")} />
          <Marker field="laydown_board" board={preview.laydown_board} y={yForDistance(1.5)} handedness={handedness} active={placementMode === "laydown_board"} onPointerDown={(event) => beginDrag("field", event, "laydown_board")} />
          <Marker field="target_board" board={preview.target_board} y={yForDistance(15)} handedness={handedness} active={placementMode === "target_board"} onPointerDown={(event) => beginDrag("field", event, "target_board")} />
          <Marker field="breakpoint_board" board={preview.breakpoint_board} y={yForDistance(44)} handedness={handedness} active={placementMode === "breakpoint_board"} onPointerDown={(event) => beginDrag("field", event, "breakpoint_board")} />
          <Marker field="pocket_board" board={preview.pocket_board} y={HEAD_PIN_Y} handedness={handedness} active={placementMode === "pocket_board"} onPointerDown={(event) => beginDrag("field", event, "pocket_board")} />
        </>}

        {!editMode && preview && !resultShot && <>
          <circle cx={xForBoard(preview.feet_board)} cy={yForFeetDepth(preview.feet_depth_ft)} r="7" fill="#071827" stroke="#78f7ff" strokeWidth="2.5" />
          <circle cx={xForBoard(preview.target_board)} cy={yForDistance(15)} r="6" fill="#00edf7" stroke="#fff" strokeWidth="2" />
          <circle cx={xForBoard(preview.breakpoint_board)} cy={yForDistance(44)} r="6" fill="#ffc66a" stroke="#fff" strokeWidth="2" />
          <circle cx={xForBoard(preview.pocket_board)} cy={HEAD_PIN_Y} r="7" fill="#fff" stroke="#00edf7" strokeWidth="2.5" />
        </>}

        <text x={VIEW_WIDTH/2} y="995" textAnchor="middle" fill="#5f7c8e" fontSize="9.5">Overhead coaching view · length compressed for readability · pin-deck zoom shows the rack in detail</text>
      </svg>

      <p className={styles.viewNote}>The cyan line always passes through the exact laydown, target, breakpoint, and pocket values shown in the form.</p>
      <div className={styles.legend}><span><i className={styles.current}/>Current line</span><span><i className={styles.breakpoint}/>Breakpoint</span><span><i className={styles.ai}/>AI suggestion</span><span><i className={styles.standing}/>Standing pin</span></div>
    </div>
  );
}
