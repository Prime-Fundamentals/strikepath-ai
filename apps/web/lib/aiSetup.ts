import type { Handedness, Recommendation, Shot, ShotInput } from "./types";
import { clampBoard, toDisplayBoard } from "./boards";

export interface AISuggestedSetup {
  sourceShotId: number;
  planType: "strike" | "spare";
  leavePins: string | null;
  feetBoard: number;
  feetDepthFt: number;
  laydownBoard: number;
  targetBoard: number;
  breakpointBoard: number;
  pocketBoard: number;
  speedMph: number | null;
  confidence: number;
  recommendedBallType: string;
}

export function buildAISuggestedSetup(
  latest: Shot | null,
  recommendation: Recommendation | null,
  handedness: Handedness,
): AISuggestedSetup | null {
  if (!latest || !recommendation) return null;

  const sourceHand = latest.handedness || "right";
  const mirror = sourceHand !== handedness;
  const board = (value: number) => mirror ? 40 - value : value;
  const sign = mirror ? -1 : 1;

  if (
    recommendation.shot_plan_type === "spare" &&
    recommendation.suggested_feet_board !== null &&
    recommendation.suggested_laydown_board !== null &&
    recommendation.suggested_target_board !== null &&
    recommendation.suggested_breakpoint_board !== null &&
    recommendation.suggested_pocket_board !== null
  ) {
    return {
      sourceShotId: latest.id,
      planType: "spare",
      leavePins: recommendation.leave_pins,
      feetBoard: clampBoard(board(recommendation.suggested_feet_board)),
      feetDepthFt: Math.max(0.5, Math.min(15, recommendation.suggested_feet_depth_ft ?? latest.feet_depth_ft ?? 11.5)),
      laydownBoard: clampBoard(board(recommendation.suggested_laydown_board)),
      targetBoard: clampBoard(board(recommendation.suggested_target_board)),
      breakpointBoard: clampBoard(board(recommendation.suggested_breakpoint_board)),
      pocketBoard: clampBoard(board(recommendation.suggested_pocket_board)),
      speedMph: recommendation.suggested_speed_mph ?? latest.speed_mph,
      confidence: recommendation.confidence,
      recommendedBallType: recommendation.recommended_ball_type || "spare",
    };
  }

  const feetDelta = recommendation.feet_delta * sign;
  const targetDelta = recommendation.target_delta * sign;
  return {
    sourceShotId: latest.id,
    planType: "strike",
    leavePins: null,
    feetBoard: clampBoard(board(latest.feet_board) + feetDelta),
    feetDepthFt: Math.max(0.5, Math.min(15, recommendation.suggested_feet_depth_ft ?? latest.feet_depth_ft ?? 11.5)),
    laydownBoard: clampBoard(board(latest.laydown_board) + feetDelta),
    targetBoard: clampBoard(board(latest.target_board) + targetDelta),
    breakpointBoard: clampBoard(board(latest.breakpoint_board)),
    pocketBoard: clampBoard(board(latest.pocket_board)),
    speedMph: recommendation.suggested_speed_mph ?? latest.speed_mph,
    confidence: recommendation.confidence,
    recommendedBallType: recommendation.recommended_ball_type || "current",
  };
}

export function setupToShotPatch(setup: AISuggestedSetup): Partial<ShotInput> {
  return {
    feet_board: setup.feetBoard,
    feet_depth_ft: setup.feetDepthFt,
    laydown_board: setup.laydownBoard,
    target_board: setup.targetBoard,
    breakpoint_board: setup.breakpointBoard,
    pocket_board: setup.pocketBoard,
    speed_mph: setup.speedMph,
  };
}

export function displayAISetup(setup: AISuggestedSetup, handedness: Handedness) {
  return {
    feet: toDisplayBoard(setup.feetBoard, handedness),
    laydown: toDisplayBoard(setup.laydownBoard, handedness),
    target: toDisplayBoard(setup.targetBoard, handedness),
    breakpoint: toDisplayBoard(setup.breakpointBoard, handedness),
    pocket: toDisplayBoard(setup.pocketBoard, handedness),
  };
}
