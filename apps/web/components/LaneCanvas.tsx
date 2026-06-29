"use client";

import { useMemo, useRef, useState } from "react";
import type { LaneState, Recommendation, Shot, ShotInput } from "@/lib/types";
import { parseLeave } from "./PinLeaveSelector";

const VIEW_WIDTH = 480;
const VIEW_HEIGHT = 850;
const LANE_LEFT = 58;
const LANE_TOP = 96;
const LANE_WIDTH = 364;
const LANE_LENGTH = 648;
const FOUL_LINE_Y = LANE_TOP + LANE_LENGTH;
const BOARD_GAP = LANE_WIDTH / 38;

type EditableField = "feet_board" | "laydown_board" | "target_board" | "breakpoint_board" | "pocket_board";

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
  const board = 39 - ratio * 38;
  return clamp(roundTo(board, step), 1, 39);
}

function formatBoard(board: number) {
  return board.toFixed(board % 1 === 0 ? 0 : board % 0.5 === 0 ? 1 : 2);
}

function pathForShot(shotLike: Pick<ShotInput, "laydown_board" | "target_board" | "breakpoint_board" | "pocket_board">) {
  return `M ${xForBoard(shotLike.laydown_board)} ${yForDistance(2)} C ${xForBoard(shotLike.target_board)} ${yForDistance(15)} ${xForBoard(shotLike.breakpoint_board)} ${yForDistance(44)} ${xForBoard(shotLike.pocket_board)} ${yForDistance(59)}`;
}

const pinPositions = {
  1: { x: 0, y: 0 },
  2: { x: -1, y: 18 },
  3: { x: 1, y: 18 },
  4: { x: -2, y: 36 },
  5: { x: 0, y: 36 },
  6: { x: 2, y: 36 },
  7: { x: -3, y: 54 },
  8: { x: -1, y: 54 },
  9: { x: 1, y: 54 },
  10: { x: 3, y: 54 },
} as const;

const fallenOffsets = {
  1: { dx: -12, dy: 3, rotate: -72 },
  2: { dx: -11, dy: 8, rotate: -64 },
  3: { dx: 11, dy: 7, rotate: 62 },
  4: { dx: -16, dy: 8, rotate: -78 },
  5: { dx: 0, dy: 11, rotate: -90 },
  6: { dx: 16, dy: 8, rotate: 78 },
  7: { dx: -14, dy: 6, rotate: -72 },
  8: { dx: -4, dy: 11, rotate: -95 },
  9: { dx: 4, dy: 11, rotate: 95 },
  10: { dx: 14, dy: 6, rotate: 72 },
} as const;

function Pin({ x, y, standing = true, pinNumber }: { x: number; y: number; standing?: boolean; pinNumber: number }) {
  const fallen = fallenOffsets[pinNumber as keyof typeof fallenOffsets];
  const transform = standing
    ? `translate(${x} ${y})`
    : `translate(${x + fallen.dx} ${y + fallen.dy}) rotate(${fallen.rotate})`;
  return (
    <g transform={transform} opacity={standing ? 1 : 0.28}>
      <ellipse cx="0" cy={standing ? 15 : 5} rx="7.6" ry="3.1" fill="rgba(0,0,0,.18)" />
      <path
        d="M 0 -12 C -4.8 -12 -7.2 -8.4 -6.1 -3.9 C -5.1 0 -5.2 2.9 -6.7 6.2 C -8.5 10.1 -5.2 15.2 0 15.2 C 5.2 15.2 8.5 10.1 6.7 6.2 C 5.2 2.9 5.1 0 6.1 -3.9 C 7.2 -8.4 4.8 -12 0 -12 Z"
        fill={standing ? "#ffffff" : "#b0bcc6"}
        stroke={standing ? "#b8d4e4" : "#8292a0"}
        strokeWidth="1.2"
      />
      <rect x="-1.3" y="-17" width="2.6" height="6.3" rx="1.3" fill="#ef3b50" />
    </g>
  );
}

function MarkerTag({
  x,
  y,
  label,
  board,
  fill,
  lineColor,
  dotStroke = "#ffffff",
  offsetX = 16,
  offsetY = -30,
  anchor = "start",
  draggable = false,
  onPointerDown,
}: {
  x: number;
  y: number;
  label: string;
  board: number;
  fill: string;
  lineColor: string;
  dotStroke?: string;
  offsetX?: number;
  offsetY?: number;
  anchor?: "start" | "middle" | "end";
  draggable?: boolean;
  onPointerDown?: (e: React.PointerEvent<SVGGElement>) => void;
}) {
  const tagX = clamp(x + offsetX, 80, VIEW_WIDTH - 80);
  const tagY = clamp(y + offsetY, 34, VIEW_HEIGHT - 50);
  const text = `${label} • ${formatBoard(board)}`;

  return (
    <g className={`lane-marker-group ${draggable ? "draggable" : ""}`} onPointerDown={onPointerDown}>
      <circle className="pulse-marker" cx={x} cy={y} r="8.5" fill={fill} stroke={dotStroke} strokeWidth="2.4" />
      <path d={`M ${x} ${y} L ${tagX} ${tagY + 10}`} fill="none" stroke={lineColor} strokeWidth="1.4" strokeDasharray="4 3" opacity="0.92" />
      <rect x={anchor === "end" ? tagX - 116 : anchor === "middle" ? tagX - 58 : tagX} y={tagY - 1} width="116" height="22" rx="11" fill="rgba(5,18,29,.92)" stroke={lineColor} strokeWidth="1.1" />
      <text x={tagX + (anchor === "end" ? -12 : anchor === "middle" ? 0 : 12)} y={tagY + 13} textAnchor={anchor} fill="#e8fbff" fontSize="10.5" fontWeight="800" letterSpacing=".02em">
        {text}
      </text>
    </g>
  );
}

function SuggestionGhost({ feetBoard, targetBoard, breakpointBoard, pocketBoard }: { feetBoard: number; targetBoard: number; breakpointBoard: number; pocketBoard: number }) {
  const path = pathForShot({ laydown_board: feetBoard, target_board: targetBoard, breakpoint_board: breakpointBoard, pocket_board: pocketBoard });
  return (
    <g className="recommendation-ghost">
      <path d={path} fill="none" stroke="#8cdfff" strokeWidth="2.5" strokeDasharray="8 8" opacity=".72" />
      <circle cx={xForBoard(feetBoard)} cy={FOUL_LINE_Y + 2} r="6.5" fill="rgba(140,223,255,.2)" stroke="#8cdfff" strokeWidth="2" />
      <circle cx={xForBoard(targetBoard)} cy={yForDistance(15)} r="6.5" fill="rgba(140,223,255,.2)" stroke="#8cdfff" strokeWidth="2" />
    </g>
  );
}

export function LaneCanvas({
  shots,
  laneState,
  editableShot,
  onEditShot,
  recommendation,
}: {
  shots: Shot[];
  laneState: LaneState | null;
  editableShot?: ShotInput | null;
  onEditShot?: (patch: Partial<ShotInput>) => void;
  recommendation?: Recommendation | null;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dragging, setDragging] = useState<EditableField | null>(null);

  const latestRealShot = shots[shots.length - 1] ?? null;
  const previewShot = editableShot ?? latestRealShot;
  const previewPath = previewShot ? pathForShot(previewShot) : "";
  const standingPins = useMemo(() => {
    if (!previewShot) return [] as number[];
    return parseLeave(previewShot.leave_code, previewShot.pinfall);
  }, [previewShot]);

  const recommendationPreview = latestRealShot && recommendation
    ? {
        feetBoard: clamp(latestRealShot.feet_board + recommendation.feet_delta, 1, 39),
        targetBoard: clamp(latestRealShot.target_board + recommendation.target_delta, 1, 39),
        breakpointBoard: latestRealShot.breakpoint_board,
        pocketBoard: latestRealShot.pocket_board,
      }
    : null;

  function updateFromPointer(event: React.PointerEvent<SVGSVGElement> | React.PointerEvent<SVGGElement>, field: EditableField) {
    if (!svgRef.current || !onEditShot) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH;
    const step = field === "pocket_board" ? 0.25 : 0.5;
    onEditShot({ [field]: boardForSvgX(x, step) } as Partial<ShotInput>);
  }

  function startDrag(field: EditableField, event: React.PointerEvent<SVGGElement>) {
    if (!onEditShot) return;
    event.preventDefault();
    setDragging(field);
    updateFromPointer(event, field);
  }

  function stopDrag() {
    setDragging(null);
  }

  const boardLabels = [39, 35, 30, 25, 20, 15, 10, 5, 1];
  const arrowBoards = [5, 10, 15, 20, 25, 30, 35];
  const dotBoards = [3, 8, 13, 18, 22, 27, 32, 37];

  return (
    <div className="lane-wrap">
      <svg
        ref={svgRef}
        className="lane-svg"
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        role="img"
        aria-label="Bowling lane path visualization"
        onPointerMove={(event) => {
          if (!dragging) return;
          updateFromPointer(event, dragging);
        }}
        onPointerUp={stopDrag}
        onPointerLeave={stopDrag}
      >
        <defs>
          <linearGradient id="laneWood" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#a66c39" />
            <stop offset="0.12" stopColor="#dcae74" />
            <stop offset="0.22" stopColor="#b67d42" />
            <stop offset="0.36" stopColor="#ebc38b" />
            <stop offset="0.5" stopColor="#bd844a" />
            <stop offset="0.64" stopColor="#ecc590" />
            <stop offset="0.78" stopColor="#b67d42" />
            <stop offset="1" stopColor="#d3a26a" />
          </linearGradient>
          <linearGradient id="oilWash" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8ffcff" stopOpacity=".28" />
            <stop offset=".58" stopColor="#00cbff" stopOpacity=".12" />
            <stop offset="1" stopColor="#00cbff" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="pinDeckGlow" cx="50%" cy="0%" r="85%">
            <stop offset="0" stopColor="rgba(255,255,255,.46)" />
            <stop offset="1" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
          <filter id="pathGlow">
            <feGaussianBlur stdDeviation="4.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect x="22" y="44" width="436" height="772" rx="22" fill="#050d17" stroke="#18324a" strokeWidth="2" />
        <rect x="30" y={LANE_TOP} width="20" height={LANE_LENGTH} rx="10" fill="#152230" opacity=".85" />
        <rect x={LANE_LEFT} y={LANE_TOP} width={LANE_WIDTH} height={LANE_LENGTH} rx="12" fill="url(#laneWood)" />
        <rect x={LANE_LEFT} y={LANE_TOP + 14} width={LANE_WIDTH} height={Math.round(LANE_LENGTH * 0.7)} fill="url(#oilWash)" />
        <rect x={LANE_LEFT + LANE_WIDTH} y={LANE_TOP} width="20" height={LANE_LENGTH} rx="10" fill="#152230" opacity=".85" />

        {Array.from({ length: 39 }).map((_, index) => {
          const x = LANE_LEFT + BOARD_GAP * index;
          const isMajor = index % 5 === 0;
          return <line key={index} x1={x} y1={LANE_TOP} x2={x} y2={FOUL_LINE_Y} stroke="#5f3b1c" strokeOpacity={isMajor ? ".34" : ".18"} strokeWidth={isMajor ? "1.15" : ".7"} />;
        })}

        <rect x={LANE_LEFT} y={LANE_TOP + LANE_LENGTH - 8} width={LANE_WIDTH} height="8" fill="rgba(255,255,255,.58)" />
        <rect x={LANE_LEFT} y={LANE_TOP - 5} width={LANE_WIDTH} height="26" rx="8" fill="rgba(255,255,255,.08)" />
        <rect x={LANE_LEFT + 10} y={LANE_TOP - 2} width={LANE_WIDTH - 20} height="20" rx="10" fill="url(#pinDeckGlow)" opacity=".28" />

        <line x1={LANE_LEFT} y1={yForDistance(15)} x2={LANE_LEFT + LANE_WIDTH} y2={yForDistance(15)} stroke="#0e6171" strokeOpacity=".32" strokeDasharray="6 6" />
        <line x1={LANE_LEFT} y1={yForDistance(7)} x2={LANE_LEFT + LANE_WIDTH} y2={yForDistance(7)} stroke="#0b3141" strokeOpacity=".18" strokeDasharray="4 8" />

        {dotBoards.map((board) => <circle key={`dot-${board}`} cx={xForBoard(board)} cy={yForDistance(7)} r="3" fill="rgba(255,255,255,.62)" />)}

        {arrowBoards.map((board) => {
          const x = xForBoard(board);
          const y = yForDistance(15);
          return <path key={`arrow-${board}`} d={`M ${x} ${y - 6} l 6 12 h -12 z`} fill="#344453" opacity=".85" />;
        })}

        {boardLabels.map((board) => (
          <g key={`board-${board}`}>
            <text x={xForBoard(board)} y={FOUL_LINE_Y + 22} textAnchor="middle" fill="#7c99ab" fontSize="10" fontWeight="700">{board}</text>
            <line x1={xForBoard(board)} y1={FOUL_LINE_Y + 2} x2={xForBoard(board)} y2={FOUL_LINE_Y + 10} stroke="#5f7787" strokeWidth="1" />
          </g>
        ))}

        {Object.entries(pinPositions).map(([pin, position]) => {
          const pinNumber = Number(pin) as keyof typeof pinPositions;
          const standing = standingPins.includes(pinNumber);
          return <Pin key={pin} x={VIEW_WIDTH / 2 + position.x * 15} y={LANE_TOP + 14 + position.y} standing={standing} pinNumber={pinNumber} />;
        })}

        {laneState?.paths.slice(-6, -1).map((item, idx) => {
          const d = item.samples.map((sample, sampleIndex) => `${sampleIndex === 0 ? "M" : "L"} ${xForBoard(sample.board)} ${yForDistance(sample.distance_ft)}`).join(" ");
          return <path key={item.shot_id} d={d} fill="none" stroke="#45b9d4" strokeOpacity={0.12 + idx * 0.08} strokeWidth="2.5" strokeLinecap="round" />;
        })}

        {recommendationPreview && <SuggestionGhost feetBoard={recommendationPreview.feetBoard} targetBoard={recommendationPreview.targetBoard} breakpointBoard={recommendationPreview.breakpointBoard} pocketBoard={recommendationPreview.pocketBoard} />}

        {previewPath && (
          <>
            <path id="latestBallPath" d={previewPath} fill="none" stroke="rgba(0,0,0,0)" />
            <path className="current-path-glow" d={previewPath} fill="none" stroke="#00f3ff" strokeOpacity=".22" strokeWidth="10" filter="url(#pathGlow)" strokeLinecap="round" />
            <path className="current-path" d={previewPath} fill="none" stroke="#85ffff" strokeWidth="4.5" strokeLinecap="round" />
            <g className="travel-ball">
              <circle cx="0" cy="0" r="7.5" fill="#00eaff" stroke="#ffffff" strokeWidth="2" />
              <circle cx="-1.8" cy="-2.3" r="1.1" fill="#03364a" />
              <circle cx="1.4" cy="-1.2" r="1" fill="#03364a" />
              <circle cx="0" cy="1.7" r="1" fill="#03364a" />
              <animateMotion dur="2.4s" repeatCount="indefinite" rotate="auto"><mpath href="#latestBallPath" /></animateMotion>
            </g>
          </>
        )}

        {previewShot && (
          <>
            <MarkerTag x={xForBoard(previewShot.feet_board)} y={FOUL_LINE_Y + 2} label="Feet" board={previewShot.feet_board} fill="#081827" lineColor="#65ecff" offsetX={previewShot.feet_board < 20 ? 18 : -126} offsetY={20} anchor={previewShot.feet_board < 20 ? "start" : "end"} draggable={!!onEditShot} onPointerDown={(e) => startDrag("feet_board", e)} />
            <MarkerTag x={xForBoard(previewShot.laydown_board)} y={yForDistance(2)} label="Laydown" board={previewShot.laydown_board} fill="#081827" lineColor="#7fe8ff" offsetX={previewShot.laydown_board < 20 ? 18 : -126} offsetY={-28} anchor={previewShot.laydown_board < 20 ? "start" : "end"} draggable={!!onEditShot} onPointerDown={(e) => startDrag("laydown_board", e)} />
            <MarkerTag x={xForBoard(previewShot.target_board)} y={yForDistance(15)} label="Target" board={previewShot.target_board} fill="#00f5ff" lineColor="#00f5ff" offsetX={previewShot.target_board < 20 ? 18 : -126} offsetY={-26} anchor={previewShot.target_board < 20 ? "start" : "end"} draggable={!!onEditShot} onPointerDown={(e) => startDrag("target_board", e)} />
            <MarkerTag x={xForBoard(previewShot.breakpoint_board)} y={yForDistance(44)} label="Breakpoint" board={previewShot.breakpoint_board} fill="#ffc663" lineColor="#ffc663" dotStroke="#fff5de" offsetX={previewShot.breakpoint_board < 20 ? 18 : -126} offsetY={-24} anchor={previewShot.breakpoint_board < 20 ? "start" : "end"} draggable={!!onEditShot} onPointerDown={(e) => startDrag("breakpoint_board", e)} />
            <MarkerTag x={xForBoard(previewShot.pocket_board)} y={yForDistance(59)} label="Pocket" board={previewShot.pocket_board} fill="#ffffff" lineColor="#8cf8ff" dotStroke="#00e9ff" offsetX={previewShot.pocket_board < 20 ? 18 : -126} offsetY={18} anchor={previewShot.pocket_board < 20 ? "start" : "end"} draggable={!!onEditShot} onPointerDown={(e) => startDrag("pocket_board", e)} />
          </>
        )}

        <text x={VIEW_WIDTH / 2} y="36" textAnchor="middle" fill="#8defff" fontSize="13" fontWeight="900" letterSpacing=".14em">REALISTIC LANE VIEW</text>
        <text x={VIEW_WIDTH / 2} y={VIEW_HEIGHT - 66} textAnchor="middle" fill="#607c90" fontSize="10.5" letterSpacing=".08em">BOARD NUMBERS • RIGHT-TO-LEFT 1–39 • ARROWS AT 15 FT • ESTIMATED BALL TRACK</text>
        {onEditShot && <text x={VIEW_WIDTH / 2} y={VIEW_HEIGHT - 48} textAnchor="middle" fill="#91d9e6" fontSize="11" fontWeight="700">Drag the Feet, Laydown, Target, Breakpoint, and Pocket tags directly on the lane.</text>}
      </svg>

      {recommendationPreview && recommendation && (
        <div className="lane-recommendation-panel">
          <small>Recommended next move</small>
          <strong>
            Feet {formatBoard(recommendationPreview.feetBoard)} ({recommendation.feet_delta >= 0 ? "+" : ""}{formatBoard(recommendation.feet_delta)}) • Target {formatBoard(recommendationPreview.targetBoard)} ({recommendation.target_delta >= 0 ? "+" : ""}{formatBoard(recommendation.target_delta)})
          </strong>
          <p>{recommendation.explanation}</p>
        </div>
      )}

      <div className="lane-legend"><span><i className="cyan" />Target</span><span><i className="gold" />Breakpoint</span><span><i className="white" />Pocket</span><span><i className="dark" />Feet / Laydown</span><span><i className="ghost" />Recommended line</span></div>
    </div>
  );
}
