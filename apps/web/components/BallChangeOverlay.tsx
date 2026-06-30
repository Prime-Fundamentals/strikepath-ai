import type { Ball, Shot } from "@/lib/types";
import { Icon } from "./Icons";

type Direction = "stronger" | "weaker";

function baseStrength(coverstock: string) {
  const value = coverstock.toLowerCase();
  if (value.includes("plastic")) return 1;
  if (value.includes("polyester")) return 1;
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
  if (direction === "weaker") {
    return ranked[Math.max(0, currentIndex - 1)] ?? null;
  }
  return ranked[Math.min(ranked.length - 1, currentIndex + 1)] ?? null;
}

function getBallChangeSuggestion(latest: Shot | null, balls: Ball[]) {
  if (!latest || balls.length < 2) return null;
  if (latest.delivery_quality !== "good") return null;

  const highHit = latest.pocket_board >= 18.25;
  const lightHit = latest.pocket_board <= 16.75;

  if (highHit) {
    const alt = chooseAlternative(balls, latest.ball_id, "weaker");
    return {
      title: "Possible ball change: weaker / cleaner shape",
      explanation: "This shot finished a little high. If the lane keeps tightening up, a cleaner or weaker ball could help you stay in play longer.",
      ball: alt,
      tag: "Weaker look",
    };
  }

  if (lightHit) {
    const alt = chooseAlternative(balls, latest.ball_id, "stronger");
    return {
      title: "Possible ball change: stronger read",
      explanation: "This shot looked light. If moves are not enough, a stronger ball or more surface may help the ball read the lane sooner.",
      ball: alt,
      tag: "Stronger look",
    };
  }

  return null;
}

export function BallChangeOverlay({ latest, balls }: { latest: Shot | null; balls: Ball[] }) {
  const suggestion = getBallChangeSuggestion(latest, balls);
  if (!suggestion) return null;

  return (
    <div className="ball-change-overlay glass-panel">
      <div className="recommendation-kicker"><Icon name="ball" width={18} />Equipment suggestion</div>
      <h3>{suggestion.title}</h3>
      <p>{suggestion.explanation}</p>
      <div className="ball-change-grid">
        <div>
          <small>Suggested move</small>
          <strong>{suggestion.tag}</strong>
        </div>
        <div>
          <small>Recommended ball</small>
          <strong>{suggestion.ball ? `${suggestion.ball.manufacturer} ${suggestion.ball.model}` : "Current ball or add more arsenal data"}</strong>
        </div>
      </div>
    </div>
  );
}
