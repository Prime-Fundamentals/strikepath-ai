"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Ball, Handedness, LaneState, Shot, ShotInput } from "@/lib/types";
import type { AISuggestedSetup } from "@/lib/aiSetup";
import { simulateBallPath } from "@/lib/physicsEngine";
import { OverheadLaneCanvas, type LaneSnapMode } from "./OverheadLaneCanvas";
import { BowlerPerspectiveLane } from "./BowlerPerspectiveLane";
import { PinDeckZoom } from "./PinDeckZoom";

type ViewMode = "overhead" | "perspective";
type InteractionMode = "edit" | "navigate";
type LaneDraft = Pick<ShotInput, "feet_board" | "feet_depth_ft" | "laydown_board" | "target_board" | "breakpoint_board" | "pocket_board">;

function toLaneDraft(shot: ShotInput | Shot): LaneDraft {
  return {
    feet_board: shot.feet_board,
    feet_depth_ft: shot.feet_depth_ft,
    laydown_board: shot.laydown_board,
    target_board: shot.target_board,
    breakpoint_board: shot.breakpoint_board,
    pocket_board: shot.pocket_board,
  };
}

function sameDraft(a: LaneDraft, b: LaneDraft) {
  return Object.keys(a).every((key) => Math.abs(a[key as keyof LaneDraft] - b[key as keyof LaneDraft]) < 0.001);
}

export function LaneCanvas({
  shots,
  laneState,
  editableShot,
  onEditShot,
  resultShot = null,
  handedness,
  editMode = false,
  showAiSuggestion = false,
  aiSetup = null,
  activeBall = null,
  oilLengthFt = 41,
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
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("overhead");
  const [showPinDeck, setShowPinDeck] = useState(false);
  const [snapMode, setSnapMode] = useState<LaneSnapMode>("half");
  const [interactionMode, setInteractionMode] = useState<InteractionMode>("edit");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [history, setHistory] = useState<LaneDraft[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const gestureRef = useRef<{
    type: "pan" | "pinch";
    startPan: { x: number; y: number };
    startPoint?: { x: number; y: number };
    startDistance?: number;
    startZoom: number;
  } | null>(null);

  const latest = shots[shots.length - 1] ?? null;
  const sourceShot = resultShot ?? editableShot ?? latest;
  const historyKey = `${latest?.id ?? 0}:${editableShot?.game_number ?? 0}:${editableShot?.frame_number ?? 0}`;

  useEffect(() => {
    if (!editableShot) {
      setHistory([]);
      setHistoryIndex(-1);
      return;
    }
    const initial = toLaneDraft(editableShot);
    setHistory([initial]);
    setHistoryIndex(0);
  }, [historyKey]);

  const physics = useMemo(() => sourceShot ? simulateBallPath({ shot: sourceShot, handedness, oilLengthFt, ball: activeBall }) : null, [sourceShot, handedness, oilLengthFt, activeBall]);

  function pushHistory(next: LaneDraft) {
    setHistory((current) => {
      const base = current.slice(0, historyIndex + 1);
      if (base.length && sameDraft(base[base.length - 1], next)) return current;
      const updated = [...base, next].slice(-40);
      setHistoryIndex(updated.length - 1);
      return updated;
    });
  }

  function handleEdit(patch: Partial<ShotInput>) {
    if (!editableShot || !onEditShot) return;
    const next = { ...toLaneDraft(editableShot), ...patch } as LaneDraft;
    pushHistory(next);
    onEditShot(patch);
  }

  function undo() {
    if (!onEditShot || historyIndex <= 0) return;
    const nextIndex = historyIndex - 1;
    const snapshot = history[nextIndex];
    setHistoryIndex(nextIndex);
    onEditShot(snapshot);
  }

  function redo() {
    if (!onEditShot || historyIndex >= history.length - 1) return;
    const nextIndex = historyIndex + 1;
    const snapshot = history[nextIndex];
    setHistoryIndex(nextIndex);
    onEditShot(snapshot);
  }

  function resetViewport() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  function pointerDistance(points: Array<{ x: number; y: number }>) {
    if (points.length < 2) return 0;
    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  }

  function beginNavigation(event: React.PointerEvent<HTMLDivElement>) {
    if (interactionMode !== "navigate" || viewMode !== "overhead") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointersRef.current.values()];
    if (points.length >= 2) {
      gestureRef.current = {
        type: "pinch",
        startPan: pan,
        startDistance: pointerDistance(points),
        startZoom: zoom,
      };
    } else {
      gestureRef.current = {
        type: "pan",
        startPan: pan,
        startPoint: points[0],
        startZoom: zoom,
      };
    }
  }

  function moveNavigation(event: React.PointerEvent<HTMLDivElement>) {
    if (interactionMode !== "navigate" || !gestureRef.current || !pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointersRef.current.values()];
    const gesture = gestureRef.current;
    if (points.length >= 2) {
      const distance = pointerDistance(points);
      const nextZoom = Math.min(3.2, Math.max(1, gesture.startZoom * (distance / Math.max(1, gesture.startDistance || distance))));
      setZoom(nextZoom);
      return;
    }
    if (gesture.type === "pan" && gesture.startPoint && points[0]) {
      setPan({
        x: gesture.startPan.x + points[0].x - gesture.startPoint.x,
        y: gesture.startPan.y + points[0].y - gesture.startPoint.y,
      });
    }
  }

  function endNavigation(event: React.PointerEvent<HTMLDivElement>) {
    pointersRef.current.delete(event.pointerId);
    if (!pointersRef.current.size) gestureRef.current = null;
  }

  function wheelZoom(event: React.WheelEvent<HTMLDivElement>) {
    if (interactionMode !== "navigate" || viewMode !== "overhead") return;
    event.preventDefault();
    setZoom((current) => Math.min(3.2, Math.max(1, current + (event.deltaY < 0 ? 0.15 : -0.15))));
  }

  return (
    <div className="lane-workspace">
      <div className="lane-view-toolbar">
        <div className="lane-view-tabs" role="tablist" aria-label="Lane view">
          <button type="button" className={viewMode === "overhead" ? "active" : ""} onClick={() => setViewMode("overhead")}>Overhead</button>
          <button type="button" className={viewMode === "perspective" ? "active" : ""} onClick={() => setViewMode("perspective")}>Bowler perspective</button>
          <button type="button" className={showPinDeck ? "active" : ""} onClick={() => setShowPinDeck((value) => !value)}>Pin-deck zoom</button>
        </div>
        <div className="lane-edit-actions">
          <button type="button" onClick={undo} disabled={historyIndex <= 0}>Undo</button>
          <button type="button" onClick={redo} disabled={historyIndex < 0 || historyIndex >= history.length - 1}>Redo</button>
        </div>
      </div>

      {viewMode === "overhead" && editMode && (
        <div className="lane-precision-toolbar">
          <div className="lane-snap-selector">
            <span>Snap</span>
            {(["free", "quarter", "half", "full"] as LaneSnapMode[]).map((mode) => (
              <button key={mode} type="button" className={snapMode === mode ? "active" : ""} onClick={() => setSnapMode(mode)}>
                {mode === "free" ? "Free" : mode === "quarter" ? "¼ board" : mode === "half" ? "½ board" : "1 board"}
              </button>
            ))}
          </div>
          <div className="lane-navigation-selector">
            <button type="button" className={interactionMode === "edit" ? "active" : ""} onClick={() => setInteractionMode("edit")}>Edit markers</button>
            <button type="button" className={interactionMode === "navigate" ? "active" : ""} onClick={() => setInteractionMode("navigate")}>Pan / pinch zoom</button>
            <button type="button" onClick={resetViewport} disabled={zoom === 1 && pan.x === 0 && pan.y === 0}>Reset view</button>
            <span>{Math.round(zoom * 100)}%</span>
          </div>
        </div>
      )}

      {viewMode === "overhead" ? (
        <div
          className={`lane-gesture-viewport ${interactionMode === "navigate" ? "navigate" : "edit"}`}
          onPointerDown={beginNavigation}
          onPointerMove={moveNavigation}
          onPointerUp={endNavigation}
          onPointerCancel={endNavigation}
          onWheel={wheelZoom}
        >
          <div className="lane-zoom-surface" style={{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})` }}>
            <OverheadLaneCanvas
              shots={shots}
              laneState={laneState}
              editableShot={editableShot}
              onEditShot={handleEdit}
              resultShot={resultShot}
              handedness={handedness}
              editMode={editMode && interactionMode === "edit"}
              showAiSuggestion={showAiSuggestion}
              aiSetup={aiSetup}
              activeBall={activeBall}
              oilLengthFt={oilLengthFt}
              snapMode={snapMode}
            />
          </div>
          {interactionMode === "navigate" && <div className="lane-navigation-hint">Drag to pan • pinch or mouse-wheel to zoom</div>}
        </div>
      ) : (
        <BowlerPerspectiveLane
          shot={sourceShot}
          handedness={handedness}
          oilLengthFt={oilLengthFt}
          activeBall={activeBall}
          aiSetup={aiSetup}
          showAiSuggestion={showAiSuggestion}
        />
      )}

      {showPinDeck && <PinDeckZoom shot={sourceShot} handedness={handedness} aiSetup={showAiSuggestion ? aiSetup : null} />}

      {physics && (
        <section className="physics-insight-card" aria-label="Physics simulation summary">
          <div className="physics-insight-heading">
            <div><small>ADVANCED PHYSICS PREVIEW</small><h3>Skid, hook, and roll estimate</h3></div>
            <span>{Math.round(physics.confidence * 100)}% input confidence</span>
          </div>
          <div className="physics-phase-track">
            <span className="skid" style={{ width: `${physics.skidEndFt / 60 * 100}%` }}>Skid</span>
            <span className="hook" style={{ width: `${(physics.hookEndFt - physics.skidEndFt) / 60 * 100}%` }}>Hook</span>
            <span className="roll" style={{ width: `${(60 - physics.hookEndFt) / 60 * 100}%` }}>Roll</span>
          </div>
          <div className="physics-metric-grid">
            <span><small>Skid end</small><b>{physics.skidEndFt.toFixed(1)} ft</b></span>
            <span><small>Hook end</small><b>{physics.hookEndFt.toFixed(1)} ft</b></span>
            <span><small>Projected pocket</small><b>{physics.projectedPocketBoard.toFixed(1)}</b></span>
            <span><small>Entry angle</small><b>{physics.entryAngleDeg.toFixed(1)}°</b></span>
          </div>
          <div className="physics-factor-row">{physics.factors.map((factor) => <span key={factor.label}><small>{factor.label}</small><b>{factor.value}</b></span>)}</div>
          <p>{physics.notes[0]} {physics.notes[1]}</p>
        </section>
      )}
    </div>
  );
}
