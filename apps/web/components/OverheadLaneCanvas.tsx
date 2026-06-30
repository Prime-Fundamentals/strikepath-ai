"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Ball, Handedness, LaneState, Shot, ShotInput } from "@/lib/types";
import type { AISuggestedSetup } from "@/lib/aiSetup";
import { formatBoard, handLabel, toDisplayBoard } from "@/lib/boards";
import { parseLeave } from "./PinLeaveSelector";
import { simulateBallPath, type PhysicsSample } from "@/lib/physicsEngine";

type EditableField = "feet_board" | "laydown_board" | "target_board" | "breakpoint_board" | "pocket_board";
type PlacementMode = EditableField | "path";
export type LaneSnapMode = "free" | "quarter" | "half" | "full";
type LaneDraft = Pick<ShotInput, EditableField | "feet_depth_ft">;
type PointerPoint = { x: number; y: number };
type DragState =
  | {
      type: "field";
      field: EditableField;
      pointerId: number;
      start: PointerPoint;
      moved: boolean;
    }
  | {
      type: "path";
      pointerId: number;
      start: PointerPoint;
      initial: LaneDraft;
      moved: boolean;
    };

const VIEW_WIDTH = 620;
const VIEW_HEIGHT = 950;
const LANE_LEFT = 128;
const LANE_TOP = 86;
const LANE_WIDTH = 364;
const LANE_LENGTH = 600;
const PIN_DECK_HEIGHT = 72;
const HEAD_PIN_Y = LANE_TOP + PIN_DECK_HEIGHT;
const FOUL_LINE_Y = LANE_TOP + LANE_LENGTH;
const APPROACH_BOTTOM = 882;
const APPROACH_MAX_FT = 15;
const BOARD_GAP = LANE_WIDTH / 38;
const ALL_PINS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const MAJOR_PHYSICAL_BOARDS = [39, 35, 30, 25, 20, 15, 10, 5, 1];
const APPROACH_DOT_BOARDS = [35, 30, 25, 20, 15, 10, 5];

// USBC pin spots are 12 inches center-to-center. The lane is approximately
// 41.5 inches wide, so the back row should span most of the lane width.
const PIN_CENTER_SPACING_X = LANE_WIDTH * (12 / 41.5);
const PIN_HALF_STEP_X = PIN_CENTER_SPACING_X / 2;
const PIN_ROW_SPACING_Y = PIN_DECK_HEIGHT / 3;
const PIN_TOP_RADIUS = Math.min(20.5, LANE_WIDTH * (4.75 / 41.5) / 2);

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
  const playableLength = FOUL_LINE_Y - HEAD_PIN_Y;
  return FOUL_LINE_Y - (distance / 60) * playableLength;
}

function yForFeetDepth(depthFt: number) {
  return FOUL_LINE_Y + (clamp(depthFt, 0.5, APPROACH_MAX_FT) / APPROACH_MAX_FT) * (APPROACH_BOTTOM - FOUL_LINE_Y);
}

function boardForSvgX(x: number, step = 0.01) {
  const ratio = clamp((x - LANE_LEFT) / LANE_WIDTH, 0, 1);
  return clamp(roundTo(39 - ratio * 38, step), 1, 39);
}

function feetDepthForSvgY(y: number, step = 0.1) {
  const ratio = clamp((y - FOUL_LINE_Y) / (APPROACH_BOTTOM - FOUL_LINE_Y), 0, 1);
  return clamp(roundTo(ratio * APPROACH_MAX_FT, step), 0.5, APPROACH_MAX_FT);
}

function pointerToSvg(svg: SVGSVGElement, clientX: number, clientY: number): PointerPoint {
  const rect = svg.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * VIEW_WIDTH,
    y: ((clientY - rect.top) / rect.height) * VIEW_HEIGHT,
  };
}

function pathForShot(shot: Pick<ShotInput, "laydown_board" | "target_board" | "breakpoint_board" | "pocket_board">) {
  return `M ${xForBoard(shot.laydown_board)} ${yForDistance(1.5)} C ${xForBoard(shot.target_board)} ${yForDistance(15)} ${xForBoard(shot.breakpoint_board)} ${yForDistance(44)} ${xForBoard(shot.pocket_board)} ${HEAD_PIN_Y}`;
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

function snapValue(value: number, mode: LaneSnapMode, pocket = false) {
  const step = mode === "free" ? 0.05 : mode === "quarter" ? 0.25 : mode === "half" ? 0.5 : 1;
  const effective = pocket && mode === "half" ? 0.25 : step;
  return roundTo(value, effective);
}

function snapDraft(draft: LaneDraft, mode: LaneSnapMode): LaneDraft {
  const depthStep = mode === "free" ? 0.1 : mode === "quarter" ? 0.25 : mode === "half" ? 0.5 : 1;
  return {
    feet_board: clamp(snapValue(draft.feet_board, mode), 1, 39),
    feet_depth_ft: clamp(roundTo(draft.feet_depth_ft, depthStep), 0.5, 15),
    laydown_board: clamp(snapValue(draft.laydown_board, mode), 1, 39),
    target_board: clamp(snapValue(draft.target_board, mode), 1, 39),
    breakpoint_board: clamp(snapValue(draft.breakpoint_board, mode), 1, 39),
    pocket_board: clamp(snapValue(draft.pocket_board, mode, true), 1, 39),
  };
}

function pathFromPhysics(samples: PhysicsSample[]) {
  return samples.map((sample, index) => `${index === 0 ? "M" : "L"} ${xForBoard(sample.board)} ${yForDistance(sample.distanceFt)}`).join(" ");
}

const pinPositions = {
  7: { x: -3, row: 0 },
  8: { x: -1, row: 0 },
  9: { x: 1, row: 0 },
  10: { x: 3, row: 0 },
  4: { x: -2, row: 1 },
  5: { x: 0, row: 1 },
  6: { x: 2, row: 1 },
  2: { x: -1, row: 2 },
  3: { x: 1, row: 2 },
  1: { x: 0, row: 3 },
} as const;

function PinTop({
  x,
  y,
  standing,
  impact,
  pinNumber,
  bodyGradientId,
}: {
  x: number;
  y: number;
  standing: boolean;
  impact: boolean;
  pinNumber: number;
  bodyGradientId: string;
}) {
  return (
    <g className="lane-pin-top" transform={`translate(${x} ${y})`} opacity={standing ? 1 : 0.18} pointerEvents="none">
      {impact && (
        <animate
          attributeName="opacity"
          values={standing ? ".25;1;.84;1" : "1;.5;.18"}
          dur=".7s"
          fill="freeze"
        />
      )}
      <ellipse cx="2" cy="4" rx={PIN_TOP_RADIUS + 2} ry={PIN_TOP_RADIUS - 1} fill="rgba(0,0,0,.26)" />
      <circle r={PIN_TOP_RADIUS} fill={standing ? `url(#${bodyGradientId})` : "#71818d"} stroke={standing ? "#d9edf7" : "#53626d"} strokeWidth="1.5" />
      <circle r={PIN_TOP_RADIUS * 0.62} fill="none" stroke={standing ? "#e84250" : "#64717b"} strokeWidth={PIN_TOP_RADIUS * 0.18} />
      <circle r={PIN_TOP_RADIUS * 0.37} fill={standing ? "#ffffff" : "#77858f"} stroke="rgba(60,85,100,.35)" strokeWidth="1" />
      <circle cx={-PIN_TOP_RADIUS * 0.16} cy={-PIN_TOP_RADIUS * 0.18} r={PIN_TOP_RADIUS * 0.11} fill="rgba(255,255,255,.9)" />
      <text x="0" y="3.4" textAnchor="middle" fill={standing ? "#07141d" : "#44535e"} fontSize="9" fontWeight="900">
        {pinNumber}
      </text>
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

function EditMarker({
  field,
  board,
  pointY,
  handedness,
  active,
  onPointerDown,
}: {
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
      <text x={labelX + labelWidth / 2} y={labelY + 16} textAnchor="middle" fill="#ecfbff" fontSize="10.5" fontWeight="800">
        {info.label} {display}
      </text>
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
      <text x={clamp(feetX, LANE_LEFT + 55, LANE_LEFT + LANE_WIDTH - 55)} y={feetY - 22} textAnchor="middle" fill="#f3e8ff" fontSize="10" fontWeight="900">
        AI FEET {formatBoard(toDisplayBoard(setup.feetBoard, handedness))}
      </text>
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
  const pendingPointRef = useRef<PointerPoint | null>(null);
  const frameRef = useRef<number | null>(null);
  const suppressTapRef = useRef(false);
  const [placementMode, setPlacementMode] = useState<PlacementMode>("path");
  const dragPreviewRef = useRef<LaneDraft | null>(null);
  const [dragPreview, setDragPreviewState] = useState<LaneDraft | null>(null);
  const [dragging, setDragging] = useState(false);
  const idPrefix = useId().replace(/:/g, "_");

  const latest = shots[shots.length - 1] ?? null;
  const sourceShot = resultShot ?? editableShot ?? latest;

  function setDragPreview(next: LaneDraft | null) {
    dragPreviewRef.current = next;
    setDragPreviewState(next);
  }

  useEffect(() => {
    if (!dragRef.current) setDragPreview(null);
  }, [editableShot]);

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
  }, []);

  const visualDraft = dragPreview ?? (sourceShot ? draftFromShot(sourceShot) : null);
  const visualShot = sourceShot && visualDraft ? { ...sourceShot, ...visualDraft } : sourceShot;
  const physicsResult = useMemo(() => {
    if (!visualShot || !visualDraft) return null;
    return simulateBallPath({
      shot: { ...visualShot, ...visualDraft },
      handedness,
      oilLengthFt,
      ball: activeBall,
    });
  }, [visualShot, visualDraft, handedness, oilLengthFt, activeBall]);
  const visualPath = physicsResult ? pathFromPhysics(physicsResult.samples) : (visualDraft ? pathForShot(visualDraft) : "");
  const standingPins = useMemo(() => sourceShot ? parseLeave(sourceShot.leave_code, sourceShot.pinfall) : ALL_PINS, [sourceShot]);

  function shiftedDraft(deltaBoards: number, initial: LaneDraft, snap = false): LaneDraft {
    const fields: EditableField[] = ["feet_board", "laydown_board", "target_board", "breakpoint_board", "pocket_board"];
    const minDelta = Math.max(...fields.map((field) => 1 - initial[field]));
    const maxDelta = Math.min(...fields.map((field) => 39 - initial[field]));
    const safeDelta = clamp(deltaBoards, minDelta, maxDelta);
    const next: LaneDraft = {
      feet_board: initial.feet_board + safeDelta,
      feet_depth_ft: initial.feet_depth_ft,
      laydown_board: initial.laydown_board + safeDelta,
      target_board: initial.target_board + safeDelta,
      breakpoint_board: initial.breakpoint_board + safeDelta,
      pocket_board: initial.pocket_board + safeDelta,
    };
    return snap ? snapDraft(next, snapMode) : next;
  }

  function capture(pointerId: number) {
    try {
      svgRef.current?.setPointerCapture(pointerId);
    } catch {
      // Pointer capture is not available in some embedded browsers.
    }
  }

  function beginFieldDrag(field: EditableField, event: React.PointerEvent<SVGGElement>) {
    if (!editMode || !onEditShot || resultShot || !editableShot) return;
    event.preventDefault();
    event.stopPropagation();
    capture(event.pointerId);
    const start = pointerToSvg(svgRef.current!, event.clientX, event.clientY);
    suppressTapRef.current = true;
    dragRef.current = { type: "field", field, pointerId: event.pointerId, start, moved: false };
    setDragPreview(draftFromShot(editableShot));
    setDragging(true);
  }

  function beginPathDrag(event: React.PointerEvent<SVGPathElement>) {
    if (!editMode || placementMode !== "path" || !svgRef.current || !editableShot || !onEditShot || resultShot) return;
    event.preventDefault();
    event.stopPropagation();
    capture(event.pointerId);
    const start = pointerToSvg(svgRef.current, event.clientX, event.clientY);
    suppressTapRef.current = true;
    const initial = draftFromShot(editableShot);
    dragRef.current = { type: "path", pointerId: event.pointerId, start, initial, moved: false };
    setDragPreview(initial);
    setDragging(true);
  }

  function processPendingMove() {
    frameRef.current = null;
    const drag = dragRef.current;
    const point = pendingPointRef.current;
    pendingPointRef.current = null;
    if (!drag || !point) return;

    const movedDistance = Math.hypot(point.x - drag.start.x, point.y - drag.start.y);
    if (movedDistance > 2) drag.moved = true;

    if (drag.type === "field") {
      const current = dragPreviewRef.current;
      if (!current) return;
      const next = { ...current };
      next[drag.field] = boardForSvgX(point.x, 0.01);
      if (drag.field === "feet_board") next.feet_depth_ft = feetDepthForSvgY(point.y, 0.1);
      setDragPreview(next);
      return;
    }

    const startBoard = boardForSvgX(drag.start.x, 0.01);
    const currentBoard = boardForSvgX(point.x, 0.01);
    setDragPreview(shiftedDraft(currentBoard - startBoard, drag.initial, false));
  }

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!svgRef.current || !drag || drag.pointerId !== event.pointerId) return;
    pendingPointRef.current = pointerToSvg(svgRef.current, event.clientX, event.clientY);
    if (frameRef.current === null) frameRef.current = requestAnimationFrame(processPendingMove);
  }

  function finishDrag(event: React.PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      processPendingMove();
    }

    try {
      svgRef.current?.releasePointerCapture(event.pointerId);
    } catch {
      // No-op when pointer capture was unavailable.
    }

    const committed = dragPreviewRef.current ? snapDraft(dragPreviewRef.current, snapMode) : null;
    if (committed && onEditShot && drag.moved) {
      if (drag.type === "field") {
        const patch: Partial<ShotInput> = { [drag.field]: committed[drag.field] } as Partial<ShotInput>;
        if (drag.field === "feet_board") patch.feet_depth_ft = committed.feet_depth_ft;
        onEditShot(patch);
      } else {
        onEditShot(committed);
      }
    }

    suppressTapRef.current = drag.moved;
    dragRef.current = null;
    pendingPointRef.current = null;
    setDragPreview(null);
    setDragging(false);
  }

  function handleTap(event: React.MouseEvent<SVGSVGElement>) {
    if (suppressTapRef.current) {
      suppressTapRef.current = false;
      return;
    }
    if (!editMode || !svgRef.current || !editableShot || !onEditShot || resultShot) return;
    const point = pointerToSvg(svgRef.current, event.clientX, event.clientY);

    if (placementMode === "path") {
      const initial = draftFromShot(editableShot);
      const center = (initial.feet_board + initial.laydown_board + initial.target_board + initial.breakpoint_board + initial.pocket_board) / 5;
      const tapStep = snapMode === "free" ? 0.05 : snapMode === "quarter" ? 0.25 : snapMode === "half" ? 0.5 : 1;
      const next = shiftedDraft(boardForSvgX(point.x, tapStep) - center, initial, true);
      onEditShot(next);
      return;
    }

    const patch: Partial<ShotInput> = {
      [placementMode]: boardForSvgX(point.x, snapMode === "free" ? 0.05 : snapMode === "quarter" ? 0.25 : snapMode === "half" ? (placementMode === "pocket_board" ? 0.25 : 0.5) : 1),
    } as Partial<ShotInput>;
    if (placementMode === "feet_board") patch.feet_depth_ft = feetDepthForSvgY(point.y, snapMode === "free" ? 0.1 : snapMode === "quarter" ? 0.25 : snapMode === "half" ? 0.5 : 1);
    onEditShot(patch);
  }

  const handShort = handedness === "left" ? "LH" : "RH";
  const editing = editMode && !resultShot;
  const laneBoardPatternId = `${idPrefix}_laneBoards`;
  const laneLengthToneId = `${idPrefix}_laneLength`;
  const approachToneId = `${idPrefix}_approach`;
  const gutterToneId = `${idPrefix}_gutter`;
  const oilSheenId = `${idPrefix}_oil`;
  const laneShadowId = `${idPrefix}_shadow`;
  const lineGlowId = `${idPrefix}_glow`;
  const pinBodyId = `${idPrefix}_pinBody`;
  const currentPathId = `${idPrefix}_currentPath`;

  return (
    <div className="lane-wrap">
      {editing && (
        <div className="lane-interaction-toolbar" role="toolbar" aria-label="Choose what to move">
          {placementOptions.map((option) => (
            <button key={option.key} type="button" className={placementMode === option.key ? "active" : ""} onClick={() => setPlacementMode(option.key)}>
              {option.label}
            </button>
          ))}
        </div>
      )}

      <div className="handedness-banner">
        <strong>{handLabel(handedness)} view</strong>
        <span>{dragging ? "Release to save the position." : "Board 1 starts at your bowling-hand gutter."}</span>
      </div>

      <svg
        ref={svgRef}
        className={`lane-svg ${editing ? "interactive" : ""} ${dragging ? "is-dragging" : ""}`}
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        role="img"
        aria-label={`${handLabel(handedness)} bowling lane`}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onLostPointerCapture={finishDrag}
        onClick={handleTap}
      >
        <defs>
          <pattern id={laneBoardPatternId} width={BOARD_GAP * 2} height="160" patternUnits="userSpaceOnUse">
            <rect width={BOARD_GAP} height="160" fill="#e0b06d" />
            <rect x={BOARD_GAP} width={BOARD_GAP} height="160" fill="#c99150" />
            <path d={`M ${BOARD_GAP} 0 V 160 M ${BOARD_GAP * 2} 0 V 160`} stroke="#6e431d" strokeOpacity=".28" strokeWidth=".7" />
            <path d={`M 0 80 H ${BOARD_GAP} M ${BOARD_GAP} 120 H ${BOARD_GAP * 2}`} stroke="#8c5b2e" strokeOpacity=".18" strokeWidth="1" />
          </pattern>
          <linearGradient id={laneLengthToneId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff6d2" stopOpacity=".14" />
            <stop offset=".18" stopColor="#fff" stopOpacity=".02" />
            <stop offset=".55" stopColor="#6e3b13" stopOpacity=".05" />
            <stop offset="1" stopColor="#261004" stopOpacity=".16" />
          </linearGradient>
          <linearGradient id={approachToneId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e4b16d" />
            <stop offset="1" stopColor="#b9783e" />
          </linearGradient>
          <linearGradient id={gutterToneId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#0a1118" />
            <stop offset=".45" stopColor="#32404a" />
            <stop offset=".65" stopColor="#111b23" />
            <stop offset="1" stopColor="#05090d" />
          </linearGradient>
          <linearGradient id={oilSheenId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#dcffff" stopOpacity=".16" />
            <stop offset=".55" stopColor="#63dff2" stopOpacity=".06" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <radialGradient id={pinBodyId} cx="35%" cy="28%" r="72%">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset=".72" stopColor="#f5fbff" />
            <stop offset="1" stopColor="#c7dbe6" />
          </radialGradient>
          <filter id={laneShadowId} x="-30%" y="-10%" width="160%" height="130%">
            <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#000" floodOpacity=".42" />
          </filter>
          <filter id={lineGlowId} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <rect x="4" y="42" width="612" height="888" rx="22" fill="#050d17" stroke="#18324a" strokeWidth="2" />
        <g filter={`url(#${laneShadowId})`}>
          <rect x={LANE_LEFT - 38} y={LANE_TOP - 6} width="30" height={LANE_LENGTH + 12} rx="13" fill={`url(#${gutterToneId})`} />
          <rect x={LANE_LEFT + LANE_WIDTH + 8} y={LANE_TOP - 6} width="30" height={LANE_LENGTH + 12} rx="13" fill={`url(#${gutterToneId})`} />
          <rect x={LANE_LEFT - 8} y={LANE_TOP} width="8" height={LANE_LENGTH} fill="#252d32" />
          <rect x={LANE_LEFT + LANE_WIDTH} y={LANE_TOP} width="8" height={LANE_LENGTH} fill="#252d32" />
          <rect x={LANE_LEFT} y={LANE_TOP} width={LANE_WIDTH} height={LANE_LENGTH} rx="4" fill={`url(#${laneBoardPatternId})`} />
          <rect x={LANE_LEFT} y={LANE_TOP} width={LANE_WIDTH} height={LANE_LENGTH} rx="4" fill={`url(#${laneLengthToneId})`} />
          <rect x={LANE_LEFT} y={HEAD_PIN_Y} width={LANE_WIDTH} height={FOUL_LINE_Y - HEAD_PIN_Y} fill={`url(#${oilSheenId})`} />
          <rect x={LANE_LEFT} y={FOUL_LINE_Y} width={LANE_WIDTH} height={APPROACH_BOTTOM - FOUL_LINE_Y} fill={`url(#${approachToneId})`} />
          <rect x={LANE_LEFT} y={FOUL_LINE_Y} width={LANE_WIDTH} height={APPROACH_BOTTOM - FOUL_LINE_Y} fill={`url(#${laneBoardPatternId})`} opacity=".42" />
        </g>

        <rect x={LANE_LEFT} y={LANE_TOP} width={LANE_WIDTH} height={PIN_DECK_HEIGHT + 10} fill="#f3cc8b" opacity=".18" />
        <line x1={LANE_LEFT} y1={HEAD_PIN_Y + 10} x2={LANE_LEFT + LANE_WIDTH} y2={HEAD_PIN_Y + 10} stroke="#8a572d" strokeOpacity=".34" strokeWidth="1.2" />

        {Array.from({ length: 39 }).map((_, index) => {
          const x = LANE_LEFT + BOARD_GAP * index;
          return <line key={index} x1={x} y1={LANE_TOP} x2={x} y2={APPROACH_BOTTOM} stroke="#5e3a1b" strokeOpacity={index % 5 === 0 ? ".34" : ".16"} strokeWidth={index % 5 === 0 ? 1 : .55} />;
        })}
        {[120, 205, 292, 382, 468, 552].map((offset, index) => (
          <line key={`joint-${index}`} x1={LANE_LEFT} y1={LANE_TOP + offset} x2={LANE_LEFT + LANE_WIDTH} y2={LANE_TOP + offset} stroke="#855329" strokeOpacity=".10" strokeWidth="1" />
        ))}

        <rect x={LANE_LEFT} y={FOUL_LINE_Y - 5} width={LANE_WIDTH} height="10" fill="#f2f5f4" stroke="#d6dbdb" strokeWidth="1" />
        {[3, 7, 11, 15, 20, 25, 29, 33, 37].map((board) => <circle key={`lane-dot-${board}`} cx={xForBoard(board)} cy={yForDistance(7.5)} r="2.8" fill="#283039" />)}
        {[5, 10, 15, 20, 25, 30, 35].map((board) => {
          const x = xForBoard(board);
          const y = yForDistance(15);
          return <path key={`arrow-${board}`} d={`M ${x} ${y - 9} l 7.5 16 h -15 z`} fill="#2f3438" opacity=".96" />;
        })}

        <text x={LANE_LEFT - 14} y={yForDistance(15) + 4} textAnchor="end" fill="#78dce9" fontSize="10" fontWeight="800">ARROWS</text>
        <text x={LANE_LEFT - 14} y={FOUL_LINE_Y + 4} textAnchor="end" fill="#d8e8ef" fontSize="10" fontWeight="800">FOUL</text>
        <text x={VIEW_WIDTH / 2} y={LANE_TOP - 9} textAnchor="middle" fill="#dbeef5" fontSize="11" fontWeight="900">PIN DECK • TRUE-WIDTH RACK</text>

        {MAJOR_PHYSICAL_BOARDS.map((physical) => (
          <g key={`board-${physical}`}>
            <text x={xForBoard(physical)} y={FOUL_LINE_Y + 25} textAnchor="middle" fill="#f6fbff" fontSize="16" fontWeight="900">{formatBoard(toDisplayBoard(physical, handedness))}</text>
            <text x={xForBoard(physical)} y={FOUL_LINE_Y + 40} textAnchor="middle" fill="#7e9aaa" fontSize="8" fontWeight="800">{handShort}</text>
          </g>
        ))}

        {APPROACH_DOT_BOARDS.map((physical) => (
          <g key={`approach-${physical}`}>
            <circle cx={xForBoard(physical)} cy={yForFeetDepth(6)} r="4.2" fill="#2b1608" stroke="#efc98d" strokeWidth=".8" />
            <circle cx={xForBoard(physical)} cy={yForFeetDepth(12)} r="4.2" fill="#2b1608" stroke="#efc98d" strokeWidth=".8" />
            <text x={xForBoard(physical)} y={APPROACH_BOTTOM - 8} textAnchor="middle" fill="#f4fbff" fontSize="13" fontWeight="900">{formatBoard(toDisplayBoard(physical, handedness))}</text>
          </g>
        ))}
        <text x={LANE_LEFT - 14} y={yForFeetDepth(6) + 4} textAnchor="end" fill="#8fa8b7" fontSize="9" fontWeight="700">6 FT</text>
        <text x={LANE_LEFT - 14} y={yForFeetDepth(12) + 4} textAnchor="end" fill="#8fa8b7" fontSize="9" fontWeight="700">12 FT</text>

        {Object.entries(pinPositions).map(([pin, position]) => {
          const pinNumber = Number(pin);
          const x = VIEW_WIDTH / 2 + position.x * PIN_HALF_STEP_X;
          const y = LANE_TOP + 12 + position.row * PIN_ROW_SPACING_Y;
          return <circle key={`spot-${pin}`} cx={x} cy={y} r={PIN_TOP_RADIUS * .32} fill="#a55f36" opacity=".42" />;
        })}

        {Object.entries(pinPositions).map(([pin, position]) => {
          const pinNumber = Number(pin);
          const x = VIEW_WIDTH / 2 + position.x * PIN_HALF_STEP_X;
          const y = LANE_TOP + 12 + position.row * PIN_ROW_SPACING_Y;
          return (
            <PinTop
              key={`${pin}-${resultShot?.id ?? "preview"}`}
              x={x}
              y={y}
              standing={standingPins.includes(pinNumber)}
              impact={!!resultShot}
              pinNumber={pinNumber}
              bodyGradientId={pinBodyId}
            />
          );
        })}

        {showAiSuggestion && aiSetup && !resultShot && <AISuggestionOverlay setup={aiSetup} handedness={handedness} />}

        {visualPath && (
          <>
            <path id={currentPathId} d={visualPath} fill="none" stroke="transparent" />
            {editing && placementMode === "path" && (
              <path className="path-drag-hitbox" d={visualPath} fill="none" stroke="transparent" strokeWidth="32" onPointerDown={beginPathDrag} />
            )}
            <path d={visualPath} fill="none" stroke="#00f3ff" strokeOpacity=".18" strokeWidth="9" filter={`url(#${lineGlowId})`} strokeLinecap="round" />
            <path d={visualPath} fill="none" stroke="#8affff" strokeWidth="4" strokeLinecap="round" strokeDasharray={resultShot ? "700" : undefined} strokeDashoffset={resultShot ? "700" : undefined}>
              {resultShot && <animate attributeName="stroke-dashoffset" from="700" to="0" dur=".78s" fill="freeze" />}
            </path>
            {resultShot && (
              <g>
                <circle cx="0" cy="0" r="7" fill="#00eaff" stroke="#fff" strokeWidth="2" />
                <animateMotion dur=".82s" fill="freeze" rotate="auto"><mpath href={`#${currentPathId}`} /></animateMotion>
              </g>
            )}
          </>
        )}

        {visualShot && visualDraft && !resultShot && (
          editing ? (
            <>
              <EditMarker field="feet_board" board={visualDraft.feet_board} pointY={yForFeetDepth(visualDraft.feet_depth_ft)} handedness={handedness} active={placementMode === "feet_board"} onPointerDown={(event) => beginFieldDrag("feet_board", event)} />
              <EditMarker field="laydown_board" board={visualDraft.laydown_board} pointY={yForDistance(1.5)} handedness={handedness} active={placementMode === "laydown_board"} onPointerDown={(event) => beginFieldDrag("laydown_board", event)} />
              <EditMarker field="target_board" board={visualDraft.target_board} pointY={yForDistance(15)} handedness={handedness} active={placementMode === "target_board"} onPointerDown={(event) => beginFieldDrag("target_board", event)} />
              <EditMarker field="breakpoint_board" board={visualDraft.breakpoint_board} pointY={yForDistance(44)} handedness={handedness} active={placementMode === "breakpoint_board"} onPointerDown={(event) => beginFieldDrag("breakpoint_board", event)} />
              <EditMarker field="pocket_board" board={visualDraft.pocket_board} pointY={HEAD_PIN_Y} handedness={handedness} active={placementMode === "pocket_board"} onPointerDown={(event) => beginFieldDrag("pocket_board", event)} />
            </>
          ) : (
            <>
              <SimplePoint x={xForBoard(visualDraft.feet_board)} y={yForFeetDepth(visualDraft.feet_depth_ft)} color="#8affff" ring />
              <SimplePoint x={xForBoard(visualDraft.laydown_board)} y={yForDistance(1.5)} color="#8affff" ring />
              <SimplePoint x={xForBoard(visualDraft.target_board)} y={yForDistance(15)} color="#00f5ff" />
              <SimplePoint x={xForBoard(visualDraft.breakpoint_board)} y={yForDistance(44)} color="#ffc663" />
              <SimplePoint x={xForBoard(visualDraft.pocket_board)} y={HEAD_PIN_Y} color="#fff" />
            </>
          )
        )}

        <text x={VIEW_WIDTH / 2} y="30" textAnchor="middle" fill="#8defff" fontSize="13" fontWeight="900" letterSpacing=".14em">{handLabel(handedness).toUpperCase()} LANE</text>
        <text x={VIEW_WIDTH / 2} y={VIEW_HEIGHT - 20} textAnchor="middle" fill="#607c90" fontSize="10">
          {editing ? "Drag smoothly; board snapping is applied when you release." : "Board numbers follow your profile. Tap Edit line for detailed controls."}
        </text>
      </svg>

      {visualShot && visualDraft && (
        <div className="simple-line-summary" aria-label="Current shot setup">
          <span><small>Feet</small><b>{formatBoard(toDisplayBoard(visualDraft.feet_board, handedness))} at {visualDraft.feet_depth_ft.toFixed(1)} ft</b></span>
          <span><small>Target</small><b>{formatBoard(toDisplayBoard(visualDraft.target_board, handedness))}</b></span>
          <span><small>Breakpoint</small><b>{formatBoard(toDisplayBoard(visualDraft.breakpoint_board, handedness))}</b></span>
          <span><small>Speed</small><b>{visualShot.speed_mph ? `${visualShot.speed_mph.toFixed(1)} mph` : "Not entered"}</b></span>
        </div>
      )}
    </div>
  );
}
