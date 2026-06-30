import type { Recommendation } from "@/lib/types";
import { Icon } from "./Icons";

export function RecommendationCard({ recommendation }: { recommendation: Recommendation | null }) {
  if (!recommendation) {
    return <div className="recommendation-card empty"><Icon name="spark" width={28} /><h3>Ready for your first shot</h3><p>Log a controlled delivery and StrikePath will build a recommendation from the result.</p></div>;
  }
  const confidence = Math.round(recommendation.confidence * 100);
  return (
    <div className="recommendation-card">
      <div className="recommendation-kicker"><Icon name="spark" width={18} />Next-shot recommendation</div>
      <h3>{recommendation.title}</h3>
      <p>{recommendation.explanation}</p>
      <div className="move-grid">
        <div><small>Feet</small><strong>{recommendation.feet_delta === 0 ? "Hold" : `${Math.abs(recommendation.feet_delta)} ${recommendation.feet_delta > 0 ? "left" : "right"}`}</strong></div>
        <div><small>Target</small><strong>{recommendation.target_delta === 0 ? "Hold" : `${Math.abs(recommendation.target_delta)} ${recommendation.target_delta > 0 ? "left" : "right"}`}</strong></div>
        <div><small>Confidence</small><strong>{confidence}%</strong></div>
      </div>
      <div className="confidence-track"><span style={{ width: `${confidence}%` }} /></div>
      <div className="approach-rec-block">
        <small>AI suggested approach</small>
        <strong>{recommendation.approach_title}</strong>
        <p>{recommendation.approach_explanation}</p>
        <span>Start {recommendation.suggested_feet_depth_ft.toFixed(1)} ft behind the foul line</span>
      </div>
    </div>
  );
}
