import type { ARPoint } from "./types";

export interface ARVisionPoint extends ARPoint {
  time_sec: number;
  score: number;
}

export interface CalibrationSuggestion {
  points: ARPoint[];
  confidence: number;
  explanation: string;
}

export interface AutoTrackResult {
  trackPoints: ARVisionPoint[];
  keyPoints: ARPoint[];
  confidence: number;
  estimatedSpeedMph: number | null;
  estimatedEntryAngleDeg: number | null;
  diagnostics: string[];
}

const ANALYSIS_WIDTH = 240;
const ANALYSIS_HEIGHT = 135;
const MAX_ANALYSIS_SECONDS = 12;
const MAX_FRAMES = 96;
const BOARD_WIDTH_IN = 41.5 / 39;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function percentile(values: number[], ratio: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * ratio)));
  return sorted[index];
}

function pointInPolygon(x: number, y: number, polygon: Array<{ x: number; y: number }>) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersects = ((yi > y) !== (yj > y)) && x < ((xj - xi) * (y - yi)) / Math.max(0.000001, yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function getLanePolygon(calibration: ARPoint[]) {
  const [nearLeft, nearRight, farLeft, farRight] = calibration;
  return [farLeft, farRight, nearRight, nearLeft];
}

function laneBoundsAtY(y: number, calibration: ARPoint[]) {
  const [nearLeft, nearRight, farLeft, farRight] = calibration;
  const nearY = (nearLeft.y + nearRight.y) / 2;
  const farY = (farLeft.y + farRight.y) / 2;
  const denominator = Math.max(0.0001, nearY - farY);
  const t = clamp((y - farY) / denominator, 0, 1);
  return {
    left: farLeft.x + (nearLeft.x - farLeft.x) * t,
    right: farRight.x + (nearRight.x - farRight.x) * t,
    t,
  };
}

export function deriveBoardFromCalibration(point: ARPoint, calibration: ARPoint[]) {
  if (calibration.length < 4) return null;
  const bounds = laneBoundsAtY(point.y, calibration);
  const width = Math.max(0.001, bounds.right - bounds.left);
  const ratio = clamp((point.x - bounds.left) / width, 0, 1);
  return Math.round((39 - ratio * 38) * 2) / 2;
}

export function estimateDistanceFeet(point: ARPoint, calibration: ARPoint[]) {
  if (calibration.length < 4) return null;
  const bounds = laneBoundsAtY(point.y, calibration);
  return clamp((1 - bounds.t) * 60, 0, 60);
}

function waitForSeek(video: HTMLVideoElement, time: number) {
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      video.removeEventListener("seeked", done);
      video.removeEventListener("error", failed);
    };
    const done = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const failed = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("Unable to seek through this video."));
    };
    video.addEventListener("seeked", done, { once: true });
    video.addEventListener("error", failed, { once: true });
    video.currentTime = clamp(time, 0, Number.isFinite(video.duration) ? video.duration : time);
    window.setTimeout(done, 900);
  });
}

function prepareCanvas(canvas: HTMLCanvasElement) {
  canvas.width = ANALYSIS_WIDTH;
  canvas.height = ANALYSIS_HEIGHT;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas image analysis is unavailable in this browser.");
  return context;
}

function longestWarmSegment(data: Uint8ClampedArray, width: number, height: number, yRatio: number) {
  const yCenter = Math.round(clamp(yRatio, 0, 1) * (height - 1));
  const rowStart = Math.max(0, yCenter - 3);
  const rowEnd = Math.min(height - 1, yCenter + 3);
  const scores: number[] = [];

  for (let x = 0; x < width; x += 1) {
    let score = 0;
    let count = 0;
    for (let y = rowStart; y <= rowEnd; y += 1) {
      const index = (y * width + x) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const luminance = r * 0.299 + g * 0.587 + b * 0.114;
      const warmth = (r + g * 0.78) - b * 1.18;
      score += luminance * 0.35 + warmth * 0.65;
      count += 1;
    }
    scores.push(score / Math.max(1, count));
  }

  const threshold = percentile(scores, 0.57);
  const minimumWidth = Math.round(width * 0.16);
  let best = { start: Math.round(width * 0.18), end: Math.round(width * 0.82), score: 0 };
  let runStart = -1;

  for (let x = 0; x <= width; x += 1) {
    const active = x < width && scores[x] >= threshold;
    if (active && runStart === -1) runStart = x;
    if ((!active || x === width) && runStart !== -1) {
      const end = x - 1;
      const runWidth = end - runStart + 1;
      if (runWidth >= minimumWidth) {
        const average = scores.slice(runStart, end + 1).reduce((sum, value) => sum + value, 0) / runWidth;
        const widthPreference = 1 - Math.abs(runWidth / width - (yRatio > 0.5 ? 0.68 : 0.25));
        const candidateScore = average * Math.max(0.2, widthPreference);
        if (candidateScore > best.score) best = { start: runStart, end, score: candidateScore };
      }
      runStart = -1;
    }
  }

  const contrast = Math.max(1, percentile(scores, 0.85) - percentile(scores, 0.25));
  return {
    left: best.start / width,
    right: best.end / width,
    confidence: clamp(contrast / 85, 0.18, 0.88),
  };
}

export async function suggestLaneCalibration(video: HTMLVideoElement, canvas: HTMLCanvasElement): Promise<CalibrationSuggestion> {
  if (video.readyState < 2) throw new Error("Load or record a video before suggesting lane corners.");
  const context = prepareCanvas(canvas);
  context.drawImage(video, 0, 0, ANALYSIS_WIDTH, ANALYSIS_HEIGHT);
  const frame = context.getImageData(0, 0, ANALYSIS_WIDTH, ANALYSIS_HEIGHT);
  const near = longestWarmSegment(frame.data, ANALYSIS_WIDTH, ANALYSIS_HEIGHT, 0.82);
  const far = longestWarmSegment(frame.data, ANALYSIS_WIDTH, ANALYSIS_HEIGHT, 0.20);

  const nearWidth = near.right - near.left;
  const farWidth = far.right - far.left;
  const plausible = nearWidth > farWidth && nearWidth > 0.34 && farWidth > 0.08;
  const points: ARPoint[] = plausible
    ? [
        { x: clamp(near.left, 0.02, 0.82), y: 0.82, label: "Near left" },
        { x: clamp(near.right, 0.18, 0.98), y: 0.82, label: "Near right" },
        { x: clamp(far.left, 0.12, 0.74), y: 0.20, label: "Far left" },
        { x: clamp(far.right, 0.26, 0.88), y: 0.20, label: "Far right" },
      ]
    : [
        { x: 0.18, y: 0.84, label: "Near left" },
        { x: 0.82, y: 0.84, label: "Near right" },
        { x: 0.42, y: 0.18, label: "Far left" },
        { x: 0.58, y: 0.18, label: "Far right" },
      ];

  const confidence = plausible ? clamp((near.confidence + far.confidence) / 2, 0.25, 0.88) : 0.22;
  return {
    points,
    confidence,
    explanation: plausible
      ? "Lane-colored regions were detected near the approach and pin deck. Drag any suggested corner that does not match the visible lane edge."
      : "The lane edges were not clear enough for a strong detection, so a centered trapezoid was suggested as a starting point. Manual correction is required.",
  };
}

function grayscale(data: Uint8ClampedArray) {
  const result = new Uint8Array(data.length / 4);
  for (let source = 0, target = 0; source < data.length; source += 4, target += 1) {
    result[target] = Math.round(data[source] * 0.299 + data[source + 1] * 0.587 + data[source + 2] * 0.114);
  }
  return result;
}

interface Candidate {
  x: number;
  y: number;
  score: number;
  size: number;
}

function detectCandidates(previous: Uint8Array, current: Uint8Array, calibration: ARPoint[]) {
  const blockSize = 4;
  const cols = Math.floor(ANALYSIS_WIDTH / blockSize);
  const rows = Math.floor(ANALYSIS_HEIGHT / blockSize);
  const polygon = getLanePolygon(calibration);
  const blockScores = new Float32Array(cols * rows);
  const laneScores: number[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const centerX = (col * blockSize + blockSize / 2) / ANALYSIS_WIDTH;
      const centerY = (row * blockSize + blockSize / 2) / ANALYSIS_HEIGHT;
      if (!pointInPolygon(centerX, centerY, polygon)) continue;
      let sum = 0;
      let count = 0;
      for (let oy = 0; oy < blockSize; oy += 1) {
        for (let ox = 0; ox < blockSize; ox += 1) {
          const x = col * blockSize + ox;
          const y = row * blockSize + oy;
          const index = y * ANALYSIS_WIDTH + x;
          sum += Math.abs(current[index] - previous[index]);
          count += 1;
        }
      }
      const score = sum / Math.max(1, count);
      blockScores[row * cols + col] = score;
      laneScores.push(score);
    }
  }

  if (!laneScores.length) return [] as Candidate[];
  const mean = laneScores.reduce((sum, value) => sum + value, 0) / laneScores.length;
  const variance = laneScores.reduce((sum, value) => sum + (value - mean) ** 2, 0) / laneScores.length;
  const threshold = clamp(Math.max(percentile(laneScores, 0.91), mean + Math.sqrt(variance) * 1.35), 14, 68);
  const visited = new Uint8Array(cols * rows);
  const candidates: Candidate[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const startIndex = row * cols + col;
      if (visited[startIndex] || blockScores[startIndex] < threshold) continue;
      const queue = [startIndex];
      visited[startIndex] = 1;
      let weightedX = 0;
      let weightedY = 0;
      let totalScore = 0;
      let size = 0;

      while (queue.length) {
        const index = queue.pop()!;
        const currentRow = Math.floor(index / cols);
        const currentCol = index % cols;
        const score = blockScores[index];
        weightedX += (currentCol * blockSize + blockSize / 2) * score;
        weightedY += (currentRow * blockSize + blockSize / 2) * score;
        totalScore += score;
        size += 1;

        const neighbors = [
          [currentRow - 1, currentCol],
          [currentRow + 1, currentCol],
          [currentRow, currentCol - 1],
          [currentRow, currentCol + 1],
        ];
        for (const [nextRow, nextCol] of neighbors) {
          if (nextRow < 0 || nextRow >= rows || nextCol < 0 || nextCol >= cols) continue;
          const nextIndex = nextRow * cols + nextCol;
          if (visited[nextIndex] || blockScores[nextIndex] < threshold) continue;
          visited[nextIndex] = 1;
          queue.push(nextIndex);
        }
      }

      if (size < 1 || size > 26 || totalScore <= 0) continue;
      const normalizedX = weightedX / totalScore / ANALYSIS_WIDTH;
      const normalizedY = weightedY / totalScore / ANALYSIS_HEIGHT;
      const averageScore = totalScore / size;
      const sizePenalty = size > 9 ? (size - 9) * 2.8 : 0;
      candidates.push({
        x: normalizedX,
        y: normalizedY,
        score: averageScore + Math.min(size, 6) * 2.2 - sizePenalty,
        size,
      });
    }
  }

  return candidates.sort((a, b) => b.score - a.score).slice(0, 12);
}

function selectCandidate(candidates: Candidate[], previous: ARVisionPoint | null, frameTime: number) {
  if (!candidates.length) return null;
  if (!previous) {
    const nearCandidates = candidates.filter((candidate) => candidate.y >= 0.48);
    const source = nearCandidates.length ? nearCandidates : candidates;
    const best = source[0];
    return { x: best.x, y: best.y, label: "Auto track", time_sec: frameTime, score: best.score } satisfies ARVisionPoint;
  }

  let best: Candidate | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const candidate of candidates) {
    const dx = candidate.x - previous.x;
    const dy = candidate.y - previous.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > 0.23) continue;
    if (candidate.y > previous.y + 0.075) continue;
    const forwardBonus = Math.max(0, previous.y - candidate.y) * 90;
    const continuityPenalty = distance * 150;
    const score = candidate.score + forwardBonus - continuityPenalty;
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  if (!best) return null;
  return { x: best.x, y: best.y, label: "Auto track", time_sec: frameTime, score: best.score } satisfies ARVisionPoint;
}

function smoothTrack(points: ARVisionPoint[]) {
  if (points.length < 3) return points;
  return points.map((point, index) => {
    const start = Math.max(0, index - 1);
    const end = Math.min(points.length - 1, index + 1);
    const window = points.slice(start, end + 1);
    return {
      ...point,
      x: window.reduce((sum, item) => sum + item.x, 0) / window.length,
      y: window.reduce((sum, item) => sum + item.y, 0) / window.length,
    };
  });
}

function closestPointByDistance(points: ARVisionPoint[], calibration: ARPoint[], targetDistance: number) {
  return points.reduce<{ point: ARVisionPoint; delta: number } | null>((best, point) => {
    const distance = estimateDistanceFeet(point, calibration);
    if (distance === null) return best;
    const delta = Math.abs(distance - targetDistance);
    if (!best || delta < best.delta) return { point, delta };
    return best;
  }, null)?.point ?? points[0];
}

function estimateSpeed(points: ARVisionPoint[], calibration: ARPoint[]) {
  const usable = points
    .map((point) => ({ point, distance: estimateDistanceFeet(point, calibration) }))
    .filter((item): item is { point: ARVisionPoint; distance: number } => item.distance !== null)
    .filter((item) => item.distance >= 5 && item.distance <= 58);
  if (usable.length < 2) return null;
  const first = usable[0];
  const last = usable[usable.length - 1];
  const seconds = last.point.time_sec - first.point.time_sec;
  const feet = last.distance - first.distance;
  if (seconds <= 0.08 || feet <= 4) return null;
  const mph = (feet / seconds) * 0.681818;
  return clamp(Math.round(mph * 10) / 10, 5, 35);
}

function estimateEntryAngle(points: ARVisionPoint[], calibration: ARPoint[]) {
  const late = points
    .map((point) => ({
      point,
      distance: estimateDistanceFeet(point, calibration),
      board: deriveBoardFromCalibration(point, calibration),
    }))
    .filter((item): item is { point: ARVisionPoint; distance: number; board: number } => item.distance !== null && item.board !== null)
    .filter((item) => item.distance >= 48);
  if (late.length < 2) return null;
  const first = late[0];
  const last = late[late.length - 1];
  const verticalInches = Math.max(1, (last.distance - first.distance) * 12);
  const horizontalInches = Math.abs(last.board - first.board) * BOARD_WIDTH_IN;
  const angle = Math.atan2(horizontalInches, verticalInches) * (180 / Math.PI);
  return Math.round(clamp(angle, 0, 15) * 10) / 10;
}

export async function analyzeBallMotion(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  calibration: ARPoint[],
  onProgress?: (progress: number, message: string) => void,
): Promise<AutoTrackResult> {
  if (calibration.length !== 4) throw new Error("Confirm the four lane corners before running assisted tracking.");
  if (!Number.isFinite(video.duration) || video.duration <= 0) throw new Error("This video does not expose a usable duration.");

  const context = prepareCanvas(canvas);
  const originalTime = video.currentTime;
  const wasPlaying = !video.paused;
  video.pause();

  const duration = Math.min(video.duration, MAX_ANALYSIS_SECONDS);
  const frames = Math.min(MAX_FRAMES, Math.max(20, Math.round(duration * 10)));
  const step = duration / Math.max(1, frames - 1);
  let previousGray: Uint8Array | null = null;
  let previousPoint: ARVisionPoint | null = null;
  const track: ARVisionPoint[] = [];
  let misses = 0;

  try {
    for (let index = 0; index < frames; index += 1) {
      const time = Math.min(duration, index * step);
      onProgress?.(index / frames, `Analyzing frame ${index + 1} of ${frames}`);
      await waitForSeek(video, time);
      context.drawImage(video, 0, 0, ANALYSIS_WIDTH, ANALYSIS_HEIGHT);
      const frame = context.getImageData(0, 0, ANALYSIS_WIDTH, ANALYSIS_HEIGHT);
      const currentGray = grayscale(frame.data);
      if (previousGray) {
        const candidates = detectCandidates(previousGray, currentGray, calibration);
        const selected = selectCandidate(candidates, previousPoint, time);
        if (selected) {
          if (!previousPoint || selected.y <= previousPoint.y + 0.075) {
            track.push(selected);
            previousPoint = selected;
            misses = 0;
          }
        } else if (previousPoint) {
          misses += 1;
          if (misses > 5) previousPoint = null;
        }
      }
      previousGray = currentGray;
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    }
  } finally {
    await waitForSeek(video, originalTime).catch(() => undefined);
    if (wasPlaying) void video.play().catch(() => undefined);
  }

  const smoothed = smoothTrack(track)
    .filter((point, index, source) => index === 0 || Math.abs(point.y - source[index - 1].y) > 0.003 || Math.abs(point.x - source[index - 1].x) > 0.003)
    .sort((a, b) => a.time_sec - b.time_sec);

  if (smoothed.length < 5) {
    throw new Error("The motion signal was too weak for a usable ball track. Try a steadier camera, brighter lane, shorter clip, or manual path marking.");
  }

  const firstDistance = estimateDistanceFeet(smoothed[0], calibration) ?? 0;
  const lastDistance = estimateDistanceFeet(smoothed[smoothed.length - 1], calibration) ?? 0;
  const progressDistance = Math.max(0, lastDistance - firstDistance);
  const continuity = smoothed.slice(1).reduce((sum, point, index) => {
    const previous = smoothed[index];
    const delta = Math.hypot(point.x - previous.x, point.y - previous.y);
    return sum + clamp(1 - delta / 0.16, 0, 1);
  }, 0) / Math.max(1, smoothed.length - 1);
  const coverage = clamp(smoothed.length / Math.max(12, frames * 0.48), 0, 1);
  const travel = clamp(progressDistance / 50, 0, 1);
  const confidence = Math.round(clamp(coverage * 0.36 + continuity * 0.34 + travel * 0.3, 0.08, 0.94) * 100) / 100;

  const keyTargets = [2, 15, 44, 59];
  const keyLabels = ["Laydown", "Target", "Breakpoint", "Pocket"];
  const keyPoints = keyTargets.map((distance, index) => {
    const point = closestPointByDistance(smoothed, calibration, distance);
    return { x: point.x, y: point.y, label: keyLabels[index] } satisfies ARPoint;
  });

  const diagnostics = [
    `${smoothed.length} motion samples retained from ${frames} analyzed frames.`,
    `Tracked approximately ${Math.round(progressDistance)} feet of lane travel.`,
    confidence >= 0.7 ? "Track continuity is strong enough for guided review." : "Track confidence is limited; manually verify each key point.",
  ];

  onProgress?.(1, "Assisted tracking complete");
  return {
    trackPoints: smoothed,
    keyPoints,
    confidence,
    estimatedSpeedMph: estimateSpeed(smoothed, calibration),
    estimatedEntryAngleDeg: estimateEntryAngle(smoothed, calibration),
    diagnostics,
  };
}
