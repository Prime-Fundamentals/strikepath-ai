"use client";

import { useMemo, useRef, useState } from "react";
import type { LaneState, Recommendation, Shot, ShotInput } from "@/lib/types";
import { parseLeave } from "./PinLeaveSelector";

type EditableField = "feet_board" | "laydown_board" | "target_board" | "breakpoint_board" | "pocket_board";
type PlacementMode = EditableField | "path";
type DragState =
  | { type: "field"; field: EditableField; pointerId: number; moved: boolean }
  | {
      type: "path";
      pointerId: number;
      startX: number;
      initial: Pick<ShotInput, EditableField>;
      moved: boolean;
    };

const VIEW_WIDTH = 620;
const VIEW_HEIGHT = 930;
const LANE_LEFT = 128;
const LANE_TOP = 92;
const LANE_WIDTH = 364;
const LANE_LENGTH = 648;
const FOUL_LINE_Y = LANE_TOP + LANE_LENGTH;
const BOARD_GAP = LANE_WIDTH / 38;
const ALL_PINS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const RH_BOARD_LABELS = [39, 35, 30, 25, 20, 15, 10, 5, 1];
const LH_BOARD_LABELS = [1, 5, 10, 15, 20, 25, 30, 35, 39];

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

function formatBoard(board: number) {
  return board.toFixed(board % 1 === 0 ? 0 : board % 0.5 === 0 ? 1 : 2);
}

function pathForShot(shotLike: Pick<ShotInput, "laydown_board" | "target_board" | "breakpoint_board" | "pocket_board">) {
  return `M ${xForBoard(shotLike.laydown_board)} ${yForDistance(2)} C ${xForBoard(shotLike.target_board)} ${yForDistance(15)} ${xForBoard(shotLike.breakpoint_board)} ${yForDistance(44)} ${xForBoard(shotLike.pocket_board)} ${yForDistance(59)}`;
}

// Correct orientation: the head pin (1) is closest to the bowler / foul line.
const pinPositions = {
  7: { x: -3, y: 0 },
  8: { x: -1, y: 0 },
  9: { x: 1, y: 0 },
  10: { x: 3, y: 0 },
  4: { x: -2, y: 18 },
  5: { x: 0, y: 18 },
  6: { x: 2, y: 18 },
  2: { x: -1, y: 36 },
  3: { x: 1, y: 36 },
  1: { x: 0, y: 54 },
} as const;

function Pin({ x, y, standing, impact, pinNumber }: { x: number; y: number; standing: boolean; impact: boolean; pinNumber: number }) {
  return (
    <g transform={`translate(${x} ${y})`} opacity={standing ? 1 : 0.2}>
      {impact && (
        <animate
          attributeName="opacity"
          values={standing ? "0.25;1;0.85;1" : "1;0.55;0.2"}
          dur="0.7s"
          fill="freeze"
        />
      )}
      <ellipse cx="0" cy="15" rx="7.6" ry="3.1" fill="rgba(0,0,0,.2)" />
      <path
        d="M 0 -12 C -4.8 -12 -7.2 -8.4 -6.1 -3.9 C -5.1 0 -5.2 2.9 -6.7 6.2 C -8.5 10.1 -5.2 15.2 0 15.2 C 5.2 15.2 8.5 10.1 6.7 6.2 C 5.2 2.9 5.1 0 6.1 -3.9 C 7.2 -8.4 4.8 -12 0 -12 Z"
        fill={standing ? "#ffffff" : "#8798a5"}
        stroke={standing ? "#b8d4e4" : "#677886"}
        strokeWidth="1.2"
      />
      <rect x="-1.3" y="-17" width="2.6" height="6.3" rx="1.3" fill="#ef3b50" />
      <text x="0" y="5" textAnchor="middle" fill={standing ? "#0a1620" : "#536472"} fontSize="8" fontWeight="900">
        {pinNumber}
      </text>
    </g>
  );
}

const markerLayout: Record<EditableField, { label: string; side: "left" | "right"; y: number; color: string; fill: string }> = {
  feet_board: { label: "Feet", side: "left", y: FOUL_LINE_Y + 58, color: "#65ecff", fill: "#071827" },
  laydown_board: { label: "Laydown", side: "right", y: FOUL_LINE_Y - 18, color: "#7fe8ff", fill: "#071827" },
  target_board: { label: "Target", side: "left", y: yForDistance(15) - 10, color: "#00f5ff", fill: "#00dce8" },
  breakpoint_board: { label: "Breakpoint", side: "right", y: yForDistance(44) - 10, color: "#ffc663", fill: "#ffc663" },
  pocket_board: { label: "Pocket", side: "left", y: LANE_TOP + 96, color: "#8cf8ff", fill: "#ffffff" },
};

function Marker({
  field,
  board,
  pointY,
  active,
  enabled,
  onPointerDown,
}: {
  field: EditableField;
  board: number;
  pointY: number;
  active: boolean;
  enabled: boolean;
  onPointerDown: (event: React.PointerEvent<SVGGElement>) => void;
}) {
  const layout = markerLayout[field];
  const pointX = xForBoard(board);
  const rectX = layout.side === "left" ? 12 : VIEW_WIDTH - 112;
  const tagCenterX = layout.side === "left" ? rectX + 100 : rectX;
  const tagTextX = layout.side === "left" ? rectX + 10 : rectX + 90;
  const anchor = layout.side === "left" ? "start" : "end";

  return (
    <g className={`lane-marker ${enabled ? "interactive" : ""} ${active ? "active" : ""}`} onPointerDown={enabled ? onPointerDown : undefined}>
      <path d={`M ${pointX} ${pointY} L ${tagCenterX} ${layout.y + 11}`} fill="none" stroke={layout.color} strokeWidth="1.2" strokeDasharray="4 4" opacity=".65" />
      <circle cx={pointX} cy={pointY} r={active ? 9 : 8} fill={layout.fill} stroke={field === "pocket_board" ? "#00e9ff" : "#ffffff"} strokeWidth={active ? "3" : "2"} />
      <rect x={rectX} y={layout.y} width="100" height="24" rx="12" fill="rgba(5,18,29,.96)" stroke={layout.color} strokeWidth={active ? "1.8" : "1"} />
      <text x={tagTextX} y={layout.y + 16} textAnchor={anchor} fill="#e8fbff" fontSize="10.5" fontWeight="800">
        {layout.label} {formatBoard(board)}
      </text>
    </g>
  );
}

function SuggestionGhost({ feetBoard, targetBoard, breakpointBoard, pocketBoard }: { feetBoard: number; targetBoard: number; breakpointBoard: number; pocketBoard: number }) {
  const path = pathForShot({ laydown_board: feetBoard, target_board: targetBoard, breakpoint_board: breakpointBoard, pocket_board: pocketBoard });
  return (
    <g>
      <path d={path} fill="none" stroke="#8cdfff" strokeWidth="2.25" strokeDasharray="8 8" opacity=".58" />
      <circle cx={xForBoard(feetBoard)} cy={FOUL_LINE_Y + 2} r="6" fill="rgba(140,223,255,.12)" stroke="#8cdfff" strokeWidth="1.6" />
      <circle cx={xForBoard(targetBoard)} cy={yForDistance(15)} r="6" fill="rgba(140,223,255,.12)" stroke="#8cdfff" strokeWidth="1.6" />
    </g>
  );
}

const placementOptions: Array<{ key: PlacementMode; label: string }> = [
  { key: "path", label: "Whole path" },
  { key: "feet_board", label: "Feet" },
  { key: "laydown_board", label: "Laydown" },
  { key: "target_board", label: "Target" },
  { key: "breakpoint_board", label: "Breakpoint" },
  { key: "pocket_board", label: "Pocket" },
];

export function LaneCanvas({
  shots,
  laneState,
  editableShot,
  onEditShot,
  recommendation,
  resultShot = null,
}: {
  shots: Shot[];
  laneState: LaneState | null;
  editableShot?: ShotInput | null;
  onEditShot?: (patch: Partial<ShotInput>) => void;
  recommendation?: Recommendation | null;
  resultShot?: Shot | null;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressTapRef = useRef(false);
  const [placementMode, setPlacementMode] = useState<PlacementMode>("path");
  const [, forceRender] = useState(0);

  const latestRealShot = shots[shots.length - 1] ?? null;
  const visualShot = resultShot ?? editableShot ?? latestRealShot;
  const visualPath = visualShot ? pathForShot(visualShot) : "";
  const standingPins = useMemo(() => {
    if (!visualShot) return ALL_PINS;
    return parseLeave(visualShot.leave_code, visualShot.pinfall);
  }, [visualShot]);

  const recommendationPreview = latestRealShot && recommendation
    ? {
        feetBoard: clamp(latestRealShot.feet_board + recommendation.feet_delta, 1, 39),
        targetBoard: clamp(latestRealShot.target_board + recommendation.target_delta, 1, 39),
        breakpointBoard: latestRealShot.breakpoint_board,
        pocketBoard: latestRealShot.pocket_board,
      }
    : null;

  function applyWholePathShift(deltaBoards: number, initial: Pick<ShotInput, EditableField>) {
    if (!onEditShot) return;
    const fields: EditableField[] = ["feet_board", "laydown_board", "target_board", "breakpoint_board", "pocket_board"];
    const minDelta = Math.max(...fields.map((field) => 1 - initial[field]));
    const maxDelta = Math.min(...fields.map((field) => 39 - initial[field]));
    const safeDelta = clamp(roundTo(deltaBoards, 0.5), minDelta, maxDelta);
    onEditShot({
      feet_board: clamp(roundTo(initial.feet_board + safeDelta, 0.5), 1, 39),
      laydown_board: clamp(roundTo(initial.laydown_board + safeDelta, 0.5), 1, 39),
      target_board: clamp(roundTo(initial.target_board + safeDelta, 0.5), 1, 39),
      breakpoint_board: clamp(roundTo(initial.breakpoint_board + safeDelta, 0.5), 1, 39),
      pocket_board: clamp(roundTo(initial.pocket_board + safeDelta, 0.25), 1, 39),
    });
  }

  function beginCapture(pointerId: number) {
    if (!svgRef.current) return;
    try {
      svgRef.current.setPointerCapture(pointerId);
    } catch {
      // Pointer capture is not available in every embedded browser.
    }
  }

  function startFieldDrag(field: EditableField, event: React.PointerEvent<SVGGElement>) {
    if (!onEditShot || resultShot) return;
    event.preventDefault();
    event.stopPropagation();
    beginCapture(event.pointerId);
    suppressTapRef.current = true;
    dragRef.current = { type: "field", field, pointerId: event.pointerId, moved: false };
    forceRender((value) => value + 1);
  }

  function startPathDrag(event: React.PointerEvent<SVGPathElement>) {
    if (!svgRef.current || !editableShot || !onEditShot || resultShot) return;
    event.preventDefault();
    event.stopPropagation();
    beginCapture(event.pointerId);
    suppressTapRef.current = true;
    dragRef.current = {
      type: "path",
      pointerId: event.pointerId,
      startX: clientXToSvgX(svgRef.current, event.clientX),
      initial: {
        feet_board: editableShot.feet_board,
        laydown_board: editableShot.laydown_board,
        target_board: editableShot.target_board,
        breakpoint_board: editableShot.breakpoint_board,
        pocket_board: editableShot.pocket_board,
      },
      moved: false,
    };
    forceRender((value) => value + 1);
  }

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!svgRef.current || !drag || !onEditShot || drag.pointerId !== event.pointerId) return;
    const svgX = clientXToSvgX(svgRef.current, event.clientX);
    drag.moved = true;
    if (drag.type === "field") {
      const step = drag.field === "pocket_board" ? 0.25 : 0.5;
      onEditShot({ [drag.field]: boardForSvgX(svgX, step) } as Partial<ShotInput>);
      return;
    }
    const startBoard = boardForSvgX(drag.startX, 0.5);
    const currentBoard = boardForSvgX(svgX, 0.5);
    applyWholePathShift(currentBoard - startBoard, drag.initial);
  }

  function stopDrag(event: React.PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    suppressTapRef.current = true;
    try {
      svgRef.current?.releasePointerCapture(event.pointerId);
    } catch {
      // No-op when capture was unavailable.
    }
    dragRef.current = null;
    forceRender((value) => value + 1);
  }

  function handleLaneTap(event: React.MouseEvent<SVGSVGElement>) {
    if (suppressTapRef.current) {
      suppressTapRef.current = false;
      return;
    }
    if (!svgRef.current || !onEditShot || !editableShot || resultShot) return;
    const svgX = clientXToSvgX(svgRef.current, event.clientX);
    if (placementMode === "path") {
      const center = (editableShot.feet_board + editableShot.laydown_board + editableShot.target_board + editableShot.breakpoint_board + editableShot.pocket_board) / 5;
      applyWholePathShift(boardForSvgX(svgX, 0.5) - center, {
        feet_board: editableShot.feet_board,
        laydown_board: editableShot.laydown_board,
        target_board: editableShot.target_board,
        breakpoint_board: editableShot.breakpoint_board,
        pocket_board: editableShot.pocket_board,
      });
      return;
    }
    const step = placementMode === "pocket_board" ? 0.25 : 0.5;
    onEditShot({ [placementMode]: boardForSvgX(svgX, step) } as Partial<ShotInput>);
  }

  const arrowBoards = [5, 10, 15, 20, 25, 30, 35];
  const dotBoards = [3, 8, 13, 18, 22, 27, 32, 37];
  const drag = dragRef.current;

  return (
    <div className="lane-wrap">
      {onEditShot && (
        <div className="lane-interaction-toolbar" role="toolbar" aria-label="Lane marker placement mode">
          {placementOptions.map((option) => (
            <button key={option.key} type="button" className={placementMode === option.key ? "active" : ""} onClick={() => setPlacementMode(option.key)}>
              {option.label}
            </button>
          ))}
        </div>
      )}

      <svg
        ref={svgRef}
        className={`lane-svg ${onEditShot ? "interactive" : ""} ${drag ? "dragging" : ""}`}
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        role="img"
        aria-label="Interactive bowling lane path visualization"
        onPointerMove={handlePointerMove}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
        onClick={handleLaneTap}
      >
        <defs>
          <linearGradient id="laneWoodStable" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#a66c39" />
            <stop offset=".14" stopColor="#deb078" />
            <stop offset=".29" stopColor="#bb8145" />
            <stop offset=".46" stopColor="#edc690" />
            <stop offset=".63" stopColor="#bd844a" />
            <stop offset=".8" stopColor="#e5b97f" />
            <stop offset="1" stopColor="#a96e3b" />
          </linearGradient>
          <linearGradient id="oilWashStable" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8ffcff" stopOpacity=".22" />
            <stop offset=".6" stopColor="#00cbff" stopOpacity=".09" />
            <stop offset="1" stopColor="#00cbff" stopOpacity="0" />
          </linearGradient>
          <filter id="softGlowStable" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <rect x="4" y="42" width="612" height="862" rx="22" fill="#050d17" stroke="#18324a" strokeWidth="2" />
        <rect x={LANE_LEFT - 28} y={LANE_TOP} width="20" height={LANE_LENGTH} rx="10" fill="#152230" />
        <rect x={LANE_LEFT} y={LANE_TOP} width={LANE_WIDTH} height={LANE_LENGTH} rx="10" fill="url(#laneWoodStable)" />
        <rect x={LANE_LEFT} y={LANE_TOP + 12} width={LANE_WIDTH} height={Math.round(LANE_LENGTH * 0.7)} fill="url(#oilWashStable)" />
        <rect x={LANE_LEFT + LANE_WIDTH + 8} y={LANE_TOP} width="20" height={LANE_LENGTH} rx="10" fill="#152230" />

        {Array.from({ length: 39 }).map((_, index) => {
          const x = LANE_LEFT + BOARD_GAP * index;
          return <line key={index} x1={x} y1={LANE_TOP} x2={x} y2={FOUL_LINE_Y} stroke="#5f3b1c" strokeOpacity={index % 5 === 0 ? ".32" : ".14"} strokeWidth={index % 5 === 0 ? "1" : ".6"} />;
        })}

        <rect x={LANE_LEFT} y={FOUL_LINE_Y - 8} width={LANE_WIDTH} height="8" fill="rgba(255,255,255,.62)" />
        <line x1={LANE_LEFT} y1={yForDistance(15)} x2={LANE_LEFT + LANE_WIDTH} y2={yForDistance(15)} stroke="#0e6171" strokeOpacity=".34" strokeDasharray="6 6" />
        <line x1={LANE_LEFT} y1={yForDistance(7)} x2={LANE_LEFT + LANE_WIDTH} y2={yForDistance(7)} stroke="#0b3141" strokeOpacity=".2" strokeDasharray="4 8" />

        {dotBoards.map((board) => <circle key={`dot-${board}`} cx={xForBoard(board)} cy={yForDistance(7)} r="2.8" fill="rgba(255,255,255,.6)" />)}
        {arrowBoards.map((board) => {
          const x = xForBoard(board);
          const y = yForDistance(15);
          return <path key={`arrow-${board}`} d={`M ${x} ${y - 6} l 6 12 h -12 z`} fill="#344453" opacity=".84" />;
        })}

        <text x={LANE_LEFT - 16} y={yForDistance(15) + 4} textAnchor="end" fill="#75d8ea" fontSize="10" fontWeight="700">ARROWS</text>
        <text x={LANE_LEFT - 16} y={FOUL_LINE_Y + 4} textAnchor="end" fill="#9db2c0" fontSize="10" fontWeight="700">FOUL</text>
        <text x={VIEW_WIDTH / 2} y={LANE_TOP - 10} textAnchor="middle" fill="#d8eef5" fontSize="11" fontWeight="800">PIN DECK</text>

        {RH_BOARD_LABELS.map((board, index) => (
          <g key={`rh-${board}`}>
            <text x={xForBoard(board)} y={FOUL_LINE_Y + 24} textAnchor="middle" fill="#f4f7fa" fontSize="16" fontWeight="900">{board}</text>
            <text x={xForBoard(board)} y={FOUL_LINE_Y + 40} textAnchor="middle" fill="#b6c6cf" fontSize="9" fontWeight="700">RH</text>
          </g>
        ))}
        {LH_BOARD_LABELS.map((board, index) => (
          <g key={`lh-${board}`}>
            <text x={xForBoard(RH_BOARD_LABELS[index])} y={FOUL_LINE_Y + 60} textAnchor="middle" fill="#ff4d4d" fontSize="16" fontWeight="900">{board}</text>
            <text x={xForBoard(RH_BOARD_LABELS[index])} y={FOUL_LINE_Y + 76} textAnchor="middle" fill="#ff9a9a" fontSize="9" fontWeight="700">LH</text>
          </g>
        ))}
        <text x={LANE_LEFT - 18} y={FOUL_LINE_Y + 24} textAnchor="end" fill="#f4f7fa" fontSize="11" fontWeight="800">Right</text>
        <text x={LANE_LEFT - 18} y={FOUL_LINE_Y + 60} textAnchor="end" fill="#ff6f6f" fontSize="11" fontWeight="800">Left</text>

        {Object.entries(pinPositions).map(([pin, position]) => {
          const pinNumber = Number(pin);
          return <Pin key={`${pin}-${resultShot?.id ?? "preview"}`} x={VIEW_WIDTH / 2 + position.x * 15} y={LANE_TOP + 10 + position.y} standing={standingPins.includes(pinNumber)} impact={!!resultShot} pinNumber={pinNumber} />;
        })}

        {resultShot && <circle cx={xForBoard(resultShot.pocket_board)} cy={yForDistance(59)} r="8" fill="none" stroke="#ffffff" strokeWidth="2" opacity="0"><animate attributeName="r" values="8;34" dur=".55s" fill="freeze" /><animate attributeName="opacity" values=".8;0" dur=".55s" fill="freeze" /></circle>}

        {laneState?.paths.slice(-5, -1).map((item, index) => {
          const d = item.samples.map((sample, sampleIndex) => `${sampleIndex === 0 ? "M" : "L"} ${xForBoard(sample.board)} ${yForDistance(sample.distance_ft)}`).join(" ");
          return <path key={item.shot_id} d={d} fill="none" stroke="#45b9d4" strokeOpacity={0.12 + index * 0.07} strokeWidth="2" strokeLinecap="round" />;
        })}

        {recommendationPreview && !resultShot && <SuggestionGhost feetBoard={recommendationPreview.feetBoard} targetBoard={recommendationPreview.targetBoard} breakpointBoard={recommendationPreview.breakpointBoard} pocketBoard={recommendationPreview.pocketBoard} />}

        {visualPath && (
          <>
            <path id="stableBallPath" d={visualPath} fill="none" stroke="transparent" />
            {onEditShot && !resultShot && <path className="path-drag-hitbox" d={visualPath} fill="none" stroke="transparent" strokeWidth="30" onPointerDown={startPathDrag} />}
            <path d={visualPath} fill="none" stroke="#00f3ff" strokeOpacity=".2" strokeWidth="9" filter="url(#softGlowStable)" strokeLinecap="round" />
            <path d={visualPath} fill="none" stroke="#8affff" strokeWidth="4" strokeLinecap="round" strokeDasharray={resultShot ? "700" : undefined} strokeDashoffset={resultShot ? "700" : undefined}>
              {resultShot && <animate attributeName="stroke-dashoffset" from="700" to="0" dur=".78s" fill="freeze" />}
            </path>
            {!resultShot && <circle cx={xForBoard(visualShot!.laydown_board)} cy={yForDistance(2)} r="6.5" fill="#00eaff" stroke="#ffffff" strokeWidth="2" />}
            {resultShot && (
              <g>
                <circle cx="0" cy="0" r="7" fill="#00eaff" stroke="#ffffff" strokeWidth="2" />
                <animateMotion dur=".82s" fill="freeze" rotate="auto"><mpath href="#stableBallPath" /></animateMotion>
              </g>
            )}
          </>
        )}

        {visualShot && !resultShot && (
          <>
            <Marker field="feet_board" board={visualShot.feet_board} pointY={FOUL_LINE_Y + 2} active={placementMode === "feet_board"} enabled={!!onEditShot} onPointerDown={(event) => startFieldDrag("feet_board", event)} />
            <Marker field="laydown_board" board={visualShot.laydown_board} pointY={yForDistance(2)} active={placementMode === "laydown_board"} enabled={!!onEditShot} onPointerDown={(event) => startFieldDrag("laydown_board", event)} />
            <Marker field="target_board" board={visualShot.target_board} pointY={yForDistance(15)} active={placementMode === "target_board"} enabled={!!onEditShot} onPointerDown={(event) => startFieldDrag("target_board", event)} />
            <Marker field="breakpoint_board" board={visualShot.breakpoint_board} pointY={yForDistance(44)} active={placementMode === "breakpoint_board"} enabled={!!onEditShot} onPointerDown={(event) => startFieldDrag("breakpoint_board", event)} />
            <Marker field="pocket_board" board={visualShot.pocket_board} pointY={yForDistance(59)} active={placementMode === "pocket_board"} enabled={!!onEditShot} onPointerDown={(event) => startFieldDrag("pocket_board", event)} />
          </>
        )}

        <text x={VIEW_WIDTH / 2} y="30" textAnchor="middle" fill="#8defff" fontSize="13" fontWeight="900" letterSpacing=".14em">INTERACTIVE LANE VIEW</text>
        <text x={VIEW_WIDTH / 2} y={VIEW_HEIGHT - 26} textAnchor="middle" fill="#607c90" fontSize="10" letterSpacing=".07em">TOP ROW = RIGHT-HANDED BOARD NUMBERS • RED ROW = LEFT-HANDED BOARD NUMBERS</text>
      </svg>

      {recommendationPreview && recommendation && (
        <div className="lane-recommendation-panel">
          <small>Recommended next move</small>
          <strong>Feet {formatBoard(recommendationPreview.feetBoard)} • Target {formatBoard(recommendationPreview.targetBoard)}</strong>
          <p>{recommendation.explanation}</p>
        </div>
      )}

      <div className="lane-recommendation-panel" style={{ marginTop: 12 }}>
        <small>Board reading guide</small>
        <p>
          The white row shows <strong>right-handed board numbers</strong>. The red row shows the matching <strong>left-handed board numbers</strong>. Pins are now oriented correctly with the <strong>1 pin closest to the bowler</strong> and the 7-8-9-10 row at the back of the deck.
        </p>
      </div>

      <div className="lane-legend">
        <span><i className="cyan" />Target</span>
        <span><i className="gold" />Breakpoint</span>
        <span><i className="white" />Pocket</span>
        <span><i className="ghost" />Recommended line</span>
      </div>
    </div>
  );
}
