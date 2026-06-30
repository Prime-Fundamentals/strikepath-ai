import type { Recommendation } from "@/lib/types";
import { Icon } from "./Icons";

export function RecommendationCard({ recommendation }: { recommendation: Recommendation | null }) {
  if (!recommendation) {
    return <div className="recommendation-card empty"><Icon name="spark" width={28} /><h3>Ready for your first shot</h3><p>Log the result. StrikePath will then show one simple next-shot suggestion.</p></div>;
  }

  const confidence = Math.round(recommendation.confidence * 100);
  const move = recommendation.feet_delta === 0
    ? "Keep the same line"
    : `Move feet ${Math.abs(recommendation.feet_delta)} and target ${Math.abs(recommendation.target_delta)} ${recommendation.direction_label}`;

  return (
    <div className="recommendation-card simple-recommendation">
      <div className="recommendation-kicker"><Icon name="spark" width={18} />Quick answer</div>
      <h3>{recommendation.title}</h3>
      <p>{recommendation.explanation}</p>
      <div className="simple-rec-list">
        <div><small>Lane move</small><strong>{move}</strong></div>
        <div><small>Approach</small><strong>{recommendation.approach_title}</strong></div>
        <div><small>Speed</small><strong>{recommendation.suggested_speed_mph ? `${recommendation.suggested_speed_mph.toFixed(1)} mph` : recommendation.speed_title}</strong></div>
      </div>
      <div className="confidence-track"><span style={{ width: `${confidence}%` }} /></div>
    </div>
  );
}
