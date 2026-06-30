import type { Ball, Handedness, Shot } from "@/lib/types";
import { Icon } from "./Icons";

type Direction = "stronger" | "weaker";

function baseStrength(coverstock: string) {
  const value = coverstock.toLowerCase();
  if (value.includes("plastic") || value.includes("polyester")) return 1;
  if (value.includes("urethane")) return 2;
  if (value.includes("pearl")) return 3;
  if (value.includes("hybrid")) return 4;
  if (value.includes("solid")) return 5;
  if (value.includes("reactive")) return 4;
  return 3;
}

function ballStrength(ball: Ball) {
  const gritBonus = ball.surface_grit ? Math.max(0, (4000 - ball.surface_grit) / 1000) : 0;
  return baseStrength(ball.coverstock) + gritBonus;
}

function chooseAlternative(balls: Ball[], currentBallId: number | null, direction: Direction) {
  if (!balls.length) return null;
  const ranked = [...balls].sort((a, b) => ballStrength(a) - ballStrength(b));
  const current = ranked.find((ball) => ball.id === currentBallId) ?? ranked[0];
  const currentIndex = ranked.findIndex((ball) => ball.id === current.id);
  return direction === "weaker"
    ? ranked[Math.max(0, currentIndex - 1)] ?? null
    : ranked[Math.min(ranked.length - 1, currentIndex + 1)] ?? null;
}

export function getBallChangeSuggestion(latest: Shot | null, balls: Ball[], handedness?: Handedness) {
  if (!latest || balls.length < 2 || latest.delivery_quality !== "good") return null;

  const hand = handedness ?? latest.handedness ?? "right";
  const pocket = hand === "right" ? 17.5 : 22.5;
  const highSign = hand === "right" ? 1 : -1;
  const normalizedError = (latest.pocket_board - pocket) * highSign;

  if (normalizedError >= 0.75) {
    const alt = chooseAlternative(balls, latest.ball_id, "weaker");
    return {
      title: "Try a cleaner ball if this repeats",
      explanation: "The last controlled shot finished high. If the same reaction repeats, a cleaner or weaker ball may create more room downlane.",
      ball: alt,
      tag: "Weaker / cleaner",
    };
  }

  if (normalizedError <= -0.75) {
    const alt = chooseAlternative(balls, latest.ball_id, "stronger");
    return {
      title: "Try a stronger ball if this repeats",
      explanation: "The last controlled shot finished light. If the same reaction repeats, a stronger ball or more surface may read the lane sooner.",
      ball: alt,
      tag: "Stronger read",
    };
  }

  return null;
}

export function BallChangeOverlay({ latest, balls, handedness }: { latest: Shot | null; balls: Ball[]; handedness?: Handedness }) {
  const suggestion = getBallChangeSuggestion(latest, balls, handedness);
  if (!suggestion) return null;

  return (
    <div className="ball-change-overlay glass-panel">
      <div className="recommendation-kicker"><Icon name="ball" width={18} />Optional equipment idea</div>
      <h3>{suggestion.title}</h3>
      <p>{suggestion.explanation}</p>
      <div className="ball-change-grid">
        <div><small>Shape</small><strong>{suggestion.tag}</strong></div>
        <div><small>Ball</small><strong>{suggestion.ball ? `${suggestion.ball.manufacturer} ${suggestion.ball.model}` : "Keep current ball"}</strong></div>
      </div>
    </div>
  );
}
