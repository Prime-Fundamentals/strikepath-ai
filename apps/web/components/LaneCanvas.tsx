"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Ball, Handedness, LaneState, Shot, ShotInput } from "@/lib/types";
import type { AISuggestedSetup } from "@/lib/aiSetup";
import { simulateBallPath } from "@/lib/physicsEngine";
import { OverheadLaneCanvas, type LaneSnapMode } from "./OverheadLaneCanvas";
import { BowlerPerspectiveLane } from "./BowlerPerspectiveLane";
import { PinDeckZoom } from "./PinDeckZoom";
import styles from "./LaneCanvas.module.css";

type ViewMode = "overhead" | "perspective" | "pinDeck";
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
  return (Object.keys(a) as Array<keyof LaneDraft>).every((key) => Math.abs(a[key] - b[key]) < .001);
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
  const [snapMode, setSnapMode] = useState<LaneSnapMode>("half");
  const [interactionMode, setInteractionMode] = useState<InteractionMode>("edit");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [history, setHistory] = useState<LaneDraft[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const historyRef = useRef<LaneDraft[]>([]);
  const indexRef = useRef(-1);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const gestureRef = useRef<{ type: "pan" | "pinch"; startPan: { x: number; y: number }; startPoint?: { x: number; y: number }; startDistance?: number; startZoom: number } | null>(null);

  const latest = shots[shots.length - 1] ?? null;
  const sourceShot = resultShot ?? editableShot ?? latest;
  const historyKey = `${latest?.id ?? 0}:${editableShot?.game_number ?? 0}:${editableShot?.frame_number ?? 0}:${handedness}`;

  function setHistoryState(nextHistory: LaneDraft[], nextIndex: number) {
    historyRef.current = nextHistory;
    indexRef.current = nextIndex;
    setHistory(nextHistory);
    setHistoryIndex(nextIndex);
  }

  useEffect(() => {
    if (!editableShot) {
      setHistoryState([], -1);
      return;
    }
    setHistoryState([toLaneDraft(editableShot)], 0);
  }, [historyKey]);

  useEffect(() => {
    if (!editMode) {
      setInteractionMode("edit");
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  }, [editMode]);

  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    pointersRef.current.clear();
    gestureRef.current = null;
  }, [viewMode]);

  const physics = useMemo(
    () => sourceShot ? simulateBallPath({ shot: sourceShot, handedness, oilLengthFt, ball: activeBall }) : null,
    [sourceShot, handedness, oilLengthFt, activeBall],
  );

  function handleEdit(patch: Partial<ShotInput>) {
    if (!editableShot || !onEditShot) return;
    const current = toLaneDraft(editableShot);
    const next = { ...current, ...patch } as LaneDraft;
    if (sameDraft(current, next)) return;

    const existing = historyRef.current;
    const currentIndex = indexRef.current;
    const base = existing.slice(0, currentIndex + 1);
    if (!base.length || !sameDraft(base[base.length - 1], current)) base.push(current);
    if (!sameDraft(base[base.length - 1], next)) base.push(next);
    const trimmed = base.slice(-40);
    setHistoryState(trimmed, trimmed.length - 1);
    onEditShot(next);
  }

  function undo() {
    if (!onEditShot || indexRef.current <= 0) return;
    const nextIndex = indexRef.current - 1;
    const snapshot = historyRef.current[nextIndex];
    setHistoryState(historyRef.current, nextIndex);
    onEditShot(snapshot);
  }

  function redo() {
    if (!onEditShot || indexRef.current < 0 || indexRef.current >= historyRef.current.length - 1) return;
    const nextIndex = indexRef.current + 1;
    const snapshot = historyRef.current[nextIndex];
    setHistoryState(historyRef.current, nextIndex);
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
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* no-op */ }
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointersRef.current.values()];
    gestureRef.current = points.length >= 2
      ? { type:"pinch", startPan:pan, startDistance:pointerDistance(points), startZoom:zoom }
      : { type:"pan", startPan:pan, startPoint:points[0], startZoom:zoom };
  }

  function moveNavigation(event: React.PointerEvent<HTMLDivElement>) {
    if (interactionMode !== "navigate" || !gestureRef.current || !pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x:event.clientX, y:event.clientY });
    const points = [...pointersRef.current.values()];
    const gesture = gestureRef.current;
    if (points.length >= 2) {
      const distance = pointerDistance(points);
      setZoom(Math.min(3, Math.max(1, gesture.startZoom * (distance / Math.max(1, gesture.startDistance || distance)))));
      return;
    }
    if (gesture.type === "pan" && gesture.startPoint && points[0]) {
      setPan({ x:gesture.startPan.x + points[0].x - gesture.startPoint.x, y:gesture.startPan.y + points[0].y - gesture.startPoint.y });
    }
  }

  function endNavigation(event: React.PointerEvent<HTMLDivElement>) {
    pointersRef.current.delete(event.pointerId);
    if (!pointersRef.current.size) gestureRef.current = null;
  }

  function wheelZoom(event: React.WheelEvent<HTMLDivElement>) {
    if (interactionMode !== "navigate" || viewMode !== "overhead") return;
    event.preventDefault();
    setZoom((current) => Math.min(3, Math.max(1, current + (event.deltaY < 0 ? .15 : -.15))));
  }

  return (
    <div className={styles.workspace}>
      <div className={styles.viewToolbar}>
        <div className={styles.viewTabs} role="tablist" aria-label="Lane view">
          <button type="button" className={viewMode === "overhead" ? styles.active : ""} onClick={() => setViewMode("overhead")}>Overhead</button>
          <button type="button" className={viewMode === "perspective" ? styles.active : ""} onClick={() => setViewMode("perspective")}>Bowler view</button>
          <button type="button" className={viewMode === "pinDeck" ? styles.active : ""} onClick={() => setViewMode("pinDeck")}>Pin deck</button>
        </div>
        {editMode && (
          <div className={styles.editActions}>
            <button type="button" onClick={undo} disabled={historyIndex <= 0}>Undo</button>
            <button type="button" onClick={redo} disabled={historyIndex < 0 || historyIndex >= history.length - 1}>Redo</button>
          </div>
        )}
      </div>

      {viewMode === "overhead" && editMode && (
        <div className={styles.precisionToolbar}>
          <div className={styles.precisionGroup}>
            <span>Snap</span>
            {(["free","quarter","half","full"] as LaneSnapMode[]).map((mode) => (
              <button key={mode} type="button" className={snapMode === mode ? styles.active : ""} onClick={() => setSnapMode(mode)}>
                {mode === "free" ? "Free" : mode === "quarter" ? "¼ board" : mode === "half" ? "½ board" : "1 board"}
              </button>
            ))}
          </div>
          <div className={styles.precisionGroup}>
            <button type="button" className={interactionMode === "edit" ? styles.active : ""} onClick={() => setInteractionMode("edit")}>Edit line</button>
            <button type="button" className={interactionMode === "navigate" ? styles.active : ""} onClick={() => setInteractionMode("navigate")}>Zoom / pan</button>
            <button type="button" onClick={resetViewport} disabled={zoom === 1 && pan.x === 0 && pan.y === 0}>Reset view</button>
            <span>{Math.round(zoom * 100)}%</span>
          </div>
        </div>
      )}

      {viewMode === "overhead" && (
        <div
          className={`${styles.viewport} ${interactionMode === "navigate" ? styles.navigate : ""}`}
          onPointerDown={beginNavigation}
          onPointerMove={moveNavigation}
          onPointerUp={endNavigation}
          onPointerCancel={endNavigation}
          onWheel={wheelZoom}
        >
          <div className={styles.zoomSurface} style={{ transform:`translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})` }}>
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
          {interactionMode === "navigate" && <div className={styles.navigationHint}>Drag to pan · pinch or mouse-wheel to zoom</div>}
        </div>
      )}

      {viewMode === "perspective" && (
        <BowlerPerspectiveLane shot={sourceShot} handedness={handedness} oilLengthFt={oilLengthFt} activeBall={activeBall} aiSetup={aiSetup} showAiSuggestion={showAiSuggestion} />
      )}

      {viewMode === "pinDeck" && <PinDeckZoom shot={sourceShot} handedness={handedness} aiSetup={showAiSuggestion ? aiSetup : null} />}

      {physics && (
        <section className={styles.physicsCard} aria-label="Physics estimate">
          <div className={styles.physicsHeading}>
            <div><small>REACTION ESTIMATE</small><h3>Skid, hook, and roll</h3></div>
            <span>{Math.round(physics.confidence * 100)}% input confidence</span>
          </div>
          <div className={styles.phaseTrack}>
            <span className={styles.skid} style={{ width:`${physics.skidEndFt / 60 * 100}%` }}>Skid</span>
            <span className={styles.hook} style={{ width:`${(physics.hookEndFt - physics.skidEndFt) / 60 * 100}%` }}>Hook</span>
            <span className={styles.roll} style={{ width:`${(60 - physics.hookEndFt) / 60 * 100}%` }}>Roll</span>
          </div>
          <div className={styles.metricGrid}>
            <span><small>Skid end</small><b>{physics.skidEndFt.toFixed(1)} ft</b></span>
            <span><small>Hook end</small><b>{physics.hookEndFt.toFixed(1)} ft</b></span>
            <span><small>Pocket board</small><b>{physics.projectedPocketBoard.toFixed(1)}</b></span>
            <span><small>Entry angle</small><b>{physics.entryAngleDeg.toFixed(1)}°</b></span>
          </div>
          <p>{physics.notes[0]} {physics.notes[1]}</p>
        </section>
      )}
    </div>
  );
}
