from dataclasses import dataclass
from statistics import mean
from typing import Protocol


class ShotLike(Protocol):
    pocket_board: float
    target_board: float
    feet_board: float
    speed_mph: float | None
    delivery_quality: str


@dataclass
class RecommendationResult:
    feet_delta: float
    target_delta: float
    direction_label: str
    adjustment_type: str
    confidence: float
    title: str
    explanation: str


def _quality_is_trustworthy(quality: str) -> bool:
    return quality in {"good", "unknown"}


def recommend(shots: list[ShotLike], handedness: str) -> RecommendationResult:
    if not shots:
        return RecommendationResult(0, 0, "hold", "baseline", 0.35, "Establish a baseline", "Log a controlled shot before making a lane adjustment.")

    current = shots[-1]
    if not _quality_is_trustworthy(current.delivery_quality):
        return RecommendationResult(
            0,
            0,
            "hold",
            "execution check",
            0.82,
            "Repeat the shot",
            "The delivery was marked as an execution miss. Hold the line and repeat it before changing your feet or target.",
        )

    pocket = 17.5 if handedness == "right" else 22.5
    high_sign = 1 if handedness == "right" else -1
    inside_sign = 1 if handedness == "right" else -1

    trusted = [shot for shot in shots[-5:] if _quality_is_trustworthy(shot.delivery_quality)]
    normalized_errors = [(shot.pocket_board - pocket) * high_sign for shot in trusted]
    current_error = normalized_errors[-1]

    if abs(current_error) <= 0.55:
        speed_note = ""
        speeds = [shot.speed_mph for shot in trusted if shot.speed_mph is not None]
        if len(speeds) >= 3 and max(speeds) - min(speeds) > 1.5:
            speed_note = " Your speed varied more than 1.5 mph, so prioritize tempo consistency."
        return RecommendationResult(
            0,
            0,
            "hold",
            "hold",
            0.86,
            "Stay on this line",
            f"The ball finished inside the acceptable pocket window.{speed_note}",
        )

    direction = "high" if current_error > 0 else "light"
    same_direction = [err for err in normalized_errors[-3:] if (err > 0) == (current_error > 0) and abs(err) > 0.55]
    persistent = len(same_direction) >= 2
    avg_error = mean(normalized_errors[-3:]) if normalized_errors else current_error

    # A high hit moves the bowler inward toward more oil. A light hit moves outward.
    move_sign = inside_sign if direction == "high" else -inside_sign
    magnitude = 3 if abs(avg_error) > 1.8 and persistent else 2
    target_magnitude = 2 if magnitude == 3 else 1

    if not persistent:
        label = "left" if move_sign > 0 else "right"
        return RecommendationResult(
            0,
            0,
            "hold",
            "confirm trend",
            0.55,
            "Confirm the reaction once",
            f"This controlled shot finished {direction}. Repeat the same line once. If it repeats, prepare for a {magnitude}-and-{target_magnitude} move {label}.",
        )

    feet_delta = magnitude * move_sign
    target_delta = target_magnitude * move_sign
    label = "left" if move_sign > 0 else "right"
    confidence = min(0.94, 0.68 + 0.08 * len(same_direction) + min(abs(avg_error), 2.5) * 0.04)
    return RecommendationResult(
        feet_delta,
        target_delta,
        label,
        f"{magnitude}-and-{target_magnitude} angular move",
        round(confidence, 2),
        f"Move {magnitude} boards {label}",
        f"Your recent controlled shots repeatedly finished {direction}. Move your feet {magnitude} boards {label} and your target {target_magnitude} board{'s' if target_magnitude != 1 else ''} {label}, then verify the reaction with one shot.",
    )
