import type { Ball, Handedness, Shot, ShotInput } from "./types";

export type BallMotionPhase = "skid" | "hook" | "roll";

export interface PhysicsSample {
  distanceFt: number;
  board: number;
  phase: BallMotionPhase;
}

export interface PhysicsResult {
  samples: PhysicsSample[];
  skidEndFt: number;
  hookEndFt: number;
  projectedBreakpointBoard: number;
  projectedPocketBoard: number;
  entryAngleDeg: number;
  hookStrength: number;
  confidence: number;
  factors: Array<{ label: string; value: string }>;
  notes: string[];
}

export interface PhysicsInput {
  shot: Pick<
    ShotInput | Shot,
    | "laydown_board"
    | "target_board"
    | "breakpoint_board"
    | "pocket_board"
    | "speed_mph"
    | "rev_rate"
    | "axis_rotation"
    | "axis_tilt"
  >;
  handedness: Handedness;
  oilLengthFt: number;
  ball?: Ball | null;
}

const BOARD_WIDTH_IN = 41.5 / 39;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function smoothstep(value: number) {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function coverstockStrength(coverstock?: string | null) {
  const value = (coverstock || "").toLowerCase();
  if (value.includes("plastic") || value.includes("polyester")) return 0.12;
  if (value.includes("urethane")) return 0.38;
  if (value.includes("pearl")) return 0.66;
  if (value.includes("hybrid")) return 0.82;
  if (value.includes("solid")) return 0.96;
  if (value.includes("reactive")) return 0.78;
  return 0.62;
}

function surfaceStrength(grit?: number | null) {
  if (!grit) return 0.45;
  return clamp((5000 - grit) / 4200, 0.05, 1);
}

function interpolate(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function boardAtDistance(
  distanceFt: number,
  laydown: number,
  target: number,
  breakpoint: number,
  pocket: number,
  breakpointDistance: number,
  hookStrength: number,
) {
  if (distanceFt <= 15) {
    const t = smoothstep(distanceFt / 15);
    return interpolate(laydown, target, t);
  }

  if (distanceFt <= breakpointDistance) {
    const t = (distanceFt - 15) / Math.max(1, breakpointDistance - 15);
    const eased = Math.pow(clamp(t, 0, 1), 1.25 + (1 - hookStrength) * 0.6);
    return interpolate(target, breakpoint, eased);
  }

  const t = (distanceFt - breakpointDistance) / Math.max(1, 60 - breakpointDistance);
  const exponent = clamp(1.75 - hookStrength * 0.85, 0.72, 1.65);
  const eased = Math.pow(clamp(t, 0, 1), exponent);
  return interpolate(breakpoint, pocket, eased);
}

export function simulateBallPath({ shot, handedness, oilLengthFt, ball }: PhysicsInput): PhysicsResult {
  const speed = shot.speed_mph ?? 16.5;
  const revRate = shot.rev_rate ?? 320;
  const axisRotation = shot.axis_rotation ?? 45;
  const axisTilt = shot.axis_tilt ?? 12;
  const cover = coverstockStrength(ball?.coverstock);
  const surface = surfaceStrength(ball?.surface_grit);
  const differential = clamp((ball?.differential ?? 0.04) / 0.06, 0.15, 1.25);
  const rg = clamp((2.66 - (ball?.rg ?? 2.52)) / 0.22, 0.05, 1.15);
  const rev = clamp(revRate / 450, 0.15, 1.5);
  const rotation = clamp(Math.sin((axisRotation * Math.PI) / 180), 0.08, 1);
  const tiltRetention = clamp(1 - axisTilt / 75, 0.35, 1);
  const speedResistance = clamp(17 / Math.max(10, speed), 0.65, 1.35);
  const oilResistance = clamp(1 - (oilLengthFt - 40) / 38, 0.55, 1.35);

  const hookStrength = clamp(
    cover * 0.24
      + surface * 0.13
      + differential * 0.14
      + rg * 0.08
      + rev * 0.16
      + rotation * 0.13
      + tiltRetention * 0.05
      + speedResistance * 0.04
      + oilResistance * 0.03,
    0.08,
    1.35,
  );

  const skidEndFt = clamp(
    oilLengthFt
      + (speed - 16.5) * 1.15
      + (0.72 - cover) * 7.5
      + (0.52 - surface) * 4.5
      - Math.max(0, revRate - 350) / 130,
    24,
    53,
  );
  const hookWindowFt = clamp(13 - hookStrength * 5 + axisTilt * 0.035, 5.5, 15);
  const hookEndFt = clamp(skidEndFt + hookWindowFt, skidEndFt + 4, 59);
  const breakpointDistance = clamp(skidEndFt + 2.5 - hookStrength * 1.8, 28, 53);
  const hookDirection = handedness === "right" ? 1 : -1;
  const motionBias = hookDirection * clamp((hookStrength - 0.72) * 3.4 + (16.5 - speed) * 0.22, -2.8, 3.8);
  const projectedBreakpointBoard = clamp(shot.breakpoint_board + motionBias * 0.55, 1, 39);
  const projectedPocketBoard = clamp(shot.pocket_board + motionBias, 1, 39);

  const samples: PhysicsSample[] = [];
  for (let distanceFt = 0; distanceFt <= 60; distanceFt += 1) {
    const board = boardAtDistance(
      distanceFt,
      shot.laydown_board,
      shot.target_board,
      projectedBreakpointBoard,
      projectedPocketBoard,
      breakpointDistance,
      hookStrength,
    );
    const phase: BallMotionPhase = distanceFt < skidEndFt ? "skid" : distanceFt < hookEndFt ? "hook" : "roll";
    samples.push({ distanceFt, board: clamp(board, 1, 39), phase });
  }

  const sample54 = samples.find((sample) => sample.distanceFt === 54) ?? samples[samples.length - 7];
  const sample60 = samples[samples.length - 1];
  const horizontalInches = Math.abs(sample60.board - sample54.board) * BOARD_WIDTH_IN;
  const entryAngleDeg = Math.round((Math.atan2(horizontalInches, 72) * 180 / Math.PI) * 10) / 10;

  const knownInputs = [
    shot.speed_mph,
    shot.rev_rate,
    shot.axis_rotation,
    shot.axis_tilt,
    ball?.surface_grit,
    ball?.rg,
    ball?.differential,
  ].filter((value) => value !== null && value !== undefined).length;
  const confidence = Math.round(clamp(0.38 + knownInputs * 0.065, 0.38, 0.88) * 100) / 100;

  const notes = [
    hookStrength > 0.95 ? "The current inputs predict an earlier, stronger friction response." : hookStrength < 0.5 ? "The current inputs predict a straighter, later response." : "The current inputs predict a balanced skid-to-hook transition.",
    skidEndFt > oilLengthFt + 3 ? "Speed and equipment are extending skid beyond the pattern length." : skidEndFt < oilLengthFt - 2 ? "Surface, revolutions, or cover strength are reading before the end of the pattern." : "The estimated skid phase is close to the end of the oil pattern.",
    "This is a coaching simulation, not a certified lane-physics measurement.",
  ];

  return {
    samples,
    skidEndFt: Math.round(skidEndFt * 10) / 10,
    hookEndFt: Math.round(hookEndFt * 10) / 10,
    projectedBreakpointBoard: Math.round(projectedBreakpointBoard * 100) / 100,
    projectedPocketBoard: Math.round(projectedPocketBoard * 100) / 100,
    entryAngleDeg,
    hookStrength: Math.round(hookStrength * 100) / 100,
    confidence,
    factors: [
      { label: "Speed", value: `${speed.toFixed(1)} mph` },
      { label: "Revolutions", value: `${Math.round(revRate)} rpm` },
      { label: "Axis rotation", value: `${Math.round(axisRotation)}°` },
      { label: "Axis tilt", value: `${Math.round(axisTilt)}°` },
      { label: "Surface", value: ball?.surface_grit ? `${ball.surface_grit} grit` : "Estimated" },
      { label: "Oil length", value: `${oilLengthFt.toFixed(1)} ft` },
    ],
    notes,
  };
}
