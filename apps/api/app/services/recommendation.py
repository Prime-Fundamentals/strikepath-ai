from dataclasses import dataclass
from statistics import mean
from typing import Protocol


class ShotLike(Protocol):
    pocket_board: float
    target_board: float
    feet_board: float
    feet_depth_ft: float
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
    feet_depth_delta_ft: float = 0
    suggested_feet_depth_ft: float = 11.5
    approach_title: str = "Hold your approach depth"
    approach_explanation: str = "Keep the same starting depth and tempo."
    suggested_speed_mph: float | None = None
    speed_title: str = "Hold your speed"
    speed_explanation: str = "Repeat the same smooth tempo."


def _quality_is_trustworthy(quality: str) -> bool:
    return quality in {"good", "unknown"}


def _clamp_depth(value: float) -> float:
    return max(0.5, min(15.0, value))


def _approach_advice(current: ShotLike, recent: list[ShotLike]) -> tuple[float, float, str, str]:
    current_depth = getattr(current, "feet_depth_ft", 11.5) or 11.5
    speeds = [shot.speed_mph for shot in recent if shot.speed_mph is not None]
    baseline = mean(speeds[:-1]) if len(speeds) >= 3 else None

    slow = current.delivery_quality == "slow"
    fast = current.delivery_quality == "fast"
    if baseline is not None and current.speed_mph is not None:
        slow = slow or current.speed_mph < baseline - 0.8
        fast = fast or current.speed_mph > baseline + 0.8

    if slow:
        delta = 0.5
        suggested = _clamp_depth(current_depth + delta)
        return (
            delta,
            suggested,
            "Start 6 inches farther back",
            "The last shot was slower than your recent tempo. Move your starting spot about 6 inches farther from the foul line, keep the same number of steps, and avoid rushing the first step.",
        )

    if fast:
        delta = -0.5
        suggested = _clamp_depth(current_depth + delta)
        return (
            delta,
            suggested,
            "Start 6 inches closer",
            "The last shot was faster than your recent tempo. Move your starting spot about 6 inches closer to the foul line and keep the approach smooth rather than braking late.",
        )

    if current.delivery_quality in {"pulled", "missed_left", "missed_right"}:
        return (
            0,
            current_depth,
            "Hold the starting depth",
            "The miss was marked as execution-related. Keep the same approach depth and repeat the shot before changing your starting distance.",
        )

    return (
        0,
        current_depth,
        "Hold the starting depth",
        "Your speed and execution do not justify a forward-or-backward move. Keep the same approach depth and focus on repeating the tempo.",
    )



def _speed_advice(current: ShotLike, recent: list[ShotLike]) -> tuple[float | None, str, str]:
    speeds = [shot.speed_mph for shot in recent if shot.speed_mph is not None]
    previous = [shot.speed_mph for shot in recent[:-1] if shot.speed_mph is not None]
    baseline = mean(previous) if previous else (mean(speeds) if speeds else None)

    if current.speed_mph is None:
        return (
            round(baseline, 1) if baseline is not None else None,
            "Use your normal smooth speed",
            "No speed was recorded for the last shot. Keep a comfortable, repeatable tempo rather than forcing extra speed.",
        )

    if current.delivery_quality == "slow":
        suggested = baseline if baseline is not None else current.speed_mph + 0.5
        return (
            round(max(5.0, min(30.0, suggested)), 1),
            "Add a little speed",
            "The last delivery was marked slow. Keep the same line and return to your normal tempo without rushing the approach.",
        )

    if current.delivery_quality == "fast":
        suggested = baseline if baseline is not None else current.speed_mph - 0.5
        return (
            round(max(5.0, min(30.0, suggested)), 1),
            "Smooth the speed down",
            "The last delivery was marked fast. Use a smoother first step and match your normal release tempo.",
        )

    if baseline is not None and abs(current.speed_mph - baseline) > 0.8:
        return (
            round(max(5.0, min(30.0, baseline)), 1),
            "Return to your recent average",
            "The last shot was noticeably different from your recent speed. Match the recent average before making another large lane move.",
        )

    return (
        round(current.speed_mph, 1),
        "Hold this speed",
        "The last speed is close to your recent tempo. Repeat it and let the lane adjustment do the work.",
    )


def recommend(shots: list[ShotLike], handedness: str) -> RecommendationResult:
    if not shots:
        return RecommendationResult(
            0,
            0,
            "hold",
            "baseline",
            0.35,
            "Establish a baseline",
            "Log a controlled shot before making a lane adjustment.",
        )

    current = shots[-1]
    trusted = [shot for shot in shots[-5:] if _quality_is_trustworthy(shot.delivery_quality)]
    depth_delta, suggested_depth, approach_title, approach_explanation = _approach_advice(current, shots[-5:])
    suggested_speed, speed_title, speed_explanation = _speed_advice(current, shots[-5:])
    approach = {
        "feet_depth_delta_ft": depth_delta,
        "suggested_feet_depth_ft": round(suggested_depth, 2),
        "approach_title": approach_title,
        "approach_explanation": approach_explanation,
        "suggested_speed_mph": suggested_speed,
        "speed_title": speed_title,
        "speed_explanation": speed_explanation,
    }

    if current.delivery_quality in {"pulled", "missed_left", "missed_right"}:
        return RecommendationResult(
            0,
            0,
            "hold",
            "execution check",
            0.82,
            "Repeat the shot",
            "The delivery was marked as an execution miss. Hold the line and repeat it before changing your feet or target.",
            **approach,
        )

    if current.delivery_quality in {"slow", "fast"}:
        return RecommendationResult(
            0,
            0,
            "hold",
            "approach tempo",
            0.78,
            "Keep the lane line",
            "The main change should be your starting distance and tempo, not the lateral lane line. Verify the approach adjustment with one shot.",
            **approach,
        )

    pocket = 17.5 if handedness == "right" else 22.5
    high_sign = 1 if handedness == "right" else -1
    inside_sign = 1 if handedness == "right" else -1

    normalized_errors = [(shot.pocket_board - pocket) * high_sign for shot in trusted]
    current_error = normalized_errors[-1] if normalized_errors else (current.pocket_board - pocket) * high_sign

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
            **approach,
        )

    direction = "high" if current_error > 0 else "light"
    same_direction = [err for err in normalized_errors[-3:] if (err > 0) == (current_error > 0) and abs(err) > 0.55]
    persistent = len(same_direction) >= 2
    avg_error = mean(normalized_errors[-3:]) if normalized_errors else current_error

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
            **approach,
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
        **approach,
    )
