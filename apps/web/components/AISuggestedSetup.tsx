import type { Ball, Handedness, Recommendation, Shot } from "@/lib/types";
import type { AISuggestedSetup as AISuggestedSetupData } from "@/lib/aiSetup";
import { displayAISetup } from "@/lib/aiSetup";
import { formatBoard } from "@/lib/boards";
import { getBallChangeSuggestion } from "./BallChangeOverlay";
import { Icon } from "./Icons";

export function AISuggestedSetup({
  latest,
  recommendation,
  setup,
  handedness,
  balls,
  visible,
  onToggle,
  onApply,
}: {
  latest: Shot | null;
  recommendation: Recommendation | null;
  setup: AISuggestedSetupData | null;
  handedness: Handedness;
  balls: Ball[];
  visible: boolean;
  onToggle: () => void;
  onApply: () => void;
}) {
  if (!latest || !recommendation || !setup) {
    return (
      <div className="ai-setup-card glass-panel empty">
        <div className="recommendation-kicker"><Icon name="spark" width={18} />AI setup</div>
        <h3>Log one shot first</h3>
        <p>After each logged shot, StrikePath will create a simple next-shot setup with feet, approach distance, target, speed, and an optional ball idea.</p>
      </div>
    );
  }

  const display = displayAISetup(setup, handedness);
  const ballIdea = getBallChangeSuggestion(latest, balls, handedness);
  const currentBall = balls.find((ball) => ball.id === latest.ball_id) ?? null;
  const suggestedBall = ballIdea?.ball ?? currentBall;
  const confidence = Math.round(setup.confidence * 100);

  return (
    <div className="ai-setup-card glass-panel">
      <div className="ai-setup-heading">
        <div>
          <div className="recommendation-kicker"><Icon name="spark" width={18} />Updated from shot #{latest.sequence_number}</div>
          <h3>Your suggested next shot</h3>
          <p>{recommendation.title}. {recommendation.explanation}</p>
        </div>
        <span className="confidence-badge">{confidence}% confidence</span>
      </div>

      <div className="ai-setup-grid">
        <div><small>Start here</small><strong>Board {formatBoard(display.feet)}</strong><span>{setup.feetDepthFt.toFixed(1)} ft behind foul line</span></div>
        <div><small>Aim here</small><strong>Board {formatBoard(display.target)}</strong><span>Arrow target</span></div>
        <div><small>Throw speed</small><strong>{setup.speedMph ? `${setup.speedMph.toFixed(1)} mph` : "Normal speed"}</strong><span>{recommendation.speed_title}</span></div>
        <div><small>Ball</small><strong>{suggestedBall ? `${suggestedBall.manufacturer} ${suggestedBall.model}` : "Current ball"}</strong><span>{ballIdea?.tag ?? "Keep current equipment"}</span></div>
      </div>

      <div className="ai-setup-notes">
        <p><b>Approach:</b> {recommendation.approach_explanation}</p>
        <p><b>Speed:</b> {recommendation.speed_explanation}</p>
      </div>

      <div className="ai-setup-actions">
        <button type="button" className="secondary-button" onClick={onToggle}>{visible ? "Hide AI line" : "Show AI line on lane"}</button>
        <button type="button" className="primary-button" onClick={onApply}>Use this setup</button>
      </div>
    </div>
  );
}
