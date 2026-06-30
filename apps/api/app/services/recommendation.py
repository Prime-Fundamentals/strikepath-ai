from dataclasses import dataclass
from statistics import mean
from typing import Protocol


class ShotLike(Protocol):
    pocket_board: float
    target_board: float
    feet_board: float
    laydown_board: float
    breakpoint_board: float
    feet_depth_ft: float
    speed_mph: float | None
    delivery_quality: str
    pinfall: int
    leave_code: str | None
    game_number: int
    frame_number: int | None


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
    shot_plan_type: str = "strike"
    leave_pins: str | None = None
    suggested_feet_board: float | None = None
    suggested_laydown_board: float | None = None
    suggested_target_board: float | None = None
    suggested_breakpoint_board: float | None = None
    suggested_pocket_board: float | None = None
    recommended_ball_type: str = "current"


def _quality_is_trustworthy(quality: str) -> bool:
    return quality in {"good", "unknown"}


def _clamp_depth(value: float) -> float:
    return max(0.5, min(15.0, value))


def _clamp_board(value: float) -> float:
    return max(1.0, min(39.0, value))


def _parse_leave(leave_code: str | None) -> list[int]:
    if not leave_code:
        return []
    pins: list[int] = []
    for token in leave_code.replace(",", "-").split("-"):
        token = token.strip()
        if token.isdigit():
            pin = int(token)
            if 1 <= pin <= 10 and pin not in pins:
                pins.append(pin)
    return sorted(pins)


PIN_BOARD = {
    1: 20.0,
    2: 25.5,
    3: 14.5,
    4: 31.0,
    5: 20.0,
    6: 9.0,
    7: 36.5,
    8: 25.5,
    9: 14.5,
    10: 3.5,
}
PIN_ROW = {1: 0, 2: 1, 3: 1, 4: 2, 5: 2, 6: 2, 7: 3, 8: 3, 9: 3, 10: 3}
COMMON_SPLITS = {
    frozenset({7, 10}),
    frozenset({4, 6}),
    frozenset({4, 6, 7, 10}),
    frozenset({2, 7}),
    frozenset({3, 10}),
    frozenset({5, 7}),
    frozenset({5, 10}),
    frozenset({4, 9}),
    frozenset({6, 8}),
}


def _is_first_ball_of_frame(shots: list[ShotLike]) -> bool:
    if len(shots) < 2:
        return True
    current = shots[-1]
    previous = shots[-2]
    current_game = getattr(current, "game_number", None)
    current_frame = getattr(current, "frame_number", None)
    previous_game = getattr(previous, "game_number", None)
    previous_frame = getattr(previous, "frame_number", None)
    if current_frame is None or previous_frame is None:
        return True
    return current_game != previous_game or current_frame != previous_frame


def _spare_plan(current: ShotLike, leave: list[int]) -> RecommendationResult:
    leave_set = frozenset(leave)
    split = leave_set in COMMON_SPLITS
    single = len(leave) == 1

    front_row = min(PIN_ROW[pin] for pin in leave)
    front_pins = [pin for pin in leave if PIN_ROW[pin] == front_row]
    center_board = mean(PIN_BOARD[pin] for pin in leave)
    lead_pin = min(front_pins, key=lambda pin: abs(PIN_BOARD[pin] - center_board))
    lead_board = PIN_BOARD[lead_pin]

    # For clusters, shade slightly toward the remaining pins so the lead pin can
    # drive through the leave. Single pins are aimed at directly.
    carry_adjustment = 0.0 if single else max(-1.25, min(1.25, (center_board - lead_board) * 0.28))
    finish_board = _clamp_board(lead_board + carry_adjustment)

    # Straight, cross-lane spare geometry. These points intentionally produce a
    # low-hook line that is easy to repeat with plastic/polyester equipment.
    feet_board = _clamp_board(20.0 + (20.0 - finish_board) * 0.80)
    laydown_board = _clamp_board(feet_board + (finish_board - feet_board) * 0.07)
    target_board = _clamp_board(feet_board + (finish_board - feet_board) * 0.27)
    breakpoint_board = _clamp_board(feet_board + (finish_board - feet_board) * 0.73)

    current_feet = getattr(current, "feet_board", feet_board)
    current_target = getattr(current, "target_board", target_board)
    depth = _clamp_depth(getattr(current, "feet_depth_ft", 11.5) or 11.5)
    current_speed = getattr(current, "speed_mph", None)
    speed = round(max(17.0, min(19.0, current_speed or 17.5)), 1)

    pin_text = "-".join(str(pin) for pin in leave)
    if single:
        title = f"Shoot the {lead_pin} pin"
        explanation = (
            f"A straight cross-lane line is suggested for the {lead_pin} pin. "
            "Keep the wrist quiet, roll the ball end-over-end, and let the ball travel through the pin center."
        )
        confidence = 0.93
    elif split:
        title = f"Attack the front pin of the {pin_text} split"
        explanation = (
            f"The {pin_text} leave is a split. Aim at the {lead_pin} pin first and shade slightly toward the remaining pins. "
            "The conversion percentage is lower, so prioritize a clean hit on the lead pin."
        )
        confidence = 0.48
    else:
        title = f"Convert the {pin_text} leave"
        explanation = (
            f"Use the {lead_pin} pin as the lead pin and send it through the rest of the {pin_text} leave. "
            "The suggested line is straighter than the strike line to reduce over-hook."
        )
        confidence = 0.78

    use_spare_ball = single or split or any(pin in {7, 10} for pin in leave)
    ball_type = "spare" if use_spare_ball else "current"
    ball_note = "Use a plastic/polyester spare ball if available." if use_spare_ball else "Your current ball is acceptable; keep the release direct and controlled."

    return RecommendationResult(
        feet_delta=round(feet_board - current_feet, 2),
        target_delta=round(target_board - current_target, 2),
        direction_label="spare",
        adjustment_type="pin-specific spare line",
        confidence=confidence,
        title=title,
        explanation=f"{explanation} {ball_note}",
        feet_depth_delta_ft=0,
        suggested_feet_depth_ft=round(depth, 2),
        approach_title="Keep the same approach length",
        approach_explanation="Use your normal approach length and a smooth, direct release. The line change—not extra hook—should create the spare angle.",
        suggested_speed_mph=speed,
        speed_title=f"Use about {speed:.1f} mph",
        speed_explanation="Use a firm, repeatable spare speed that keeps the ball on a straighter path.",
        shot_plan_type="spare",
        leave_pins=pin_text,
        suggested_feet_board=round(feet_board, 2),
        suggested_laydown_board=round(laydown_board, 2),
        suggested_target_board=round(target_board, 2),
        suggested_breakpoint_board=round(breakpoint_board, 2),
        suggested_pocket_board=round(finish_board, 2),
        recommended_ball_type=ball_type,
    )


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
        return delta, suggested, "Start 6 inches farther back", "The last shot was slower than your recent tempo. Move your starting spot about 6 inches farther from the foul line, keep the same number of steps, and avoid rushing the first step."

    if fast:
        delta = -0.5
        suggested = _clamp_depth(current_depth + delta)
        return delta, suggested, "Start 6 inches closer", "The last shot was faster than your recent tempo. Move your starting spot about 6 inches closer to the foul line and keep the approach smooth rather than braking late."

    if current.delivery_quality in {"pulled", "missed_left", "missed_right"}:
        return 0, current_depth, "Hold the starting depth", "The miss was marked as execution-related. Keep the same approach depth and repeat the shot before changing your starting distance."

    return 0, current_depth, "Hold the starting depth", "Your speed and execution do not justify a forward-or-backward move. Keep the same approach depth and focus on repeating the tempo."


def _speed_advice(current: ShotLike, recent: list[ShotLike]) -> tuple[float | None, str, str]:
    speeds = [shot.speed_mph for shot in recent if shot.speed_mph is not None]
    previous = [shot.speed_mph for shot in recent[:-1] if shot.speed_mph is not None]
    baseline = mean(previous) if previous else (mean(speeds) if speeds else None)

    if current.speed_mph is None:
        return round(baseline, 1) if baseline is not None else None, "Use your normal smooth speed", "No speed was recorded for the last shot. Keep a comfortable, repeatable tempo rather than forcing extra speed."
    if current.delivery_quality == "slow":
        suggested = baseline if baseline is not None else current.speed_mph + 0.5
        return round(max(5.0, min(30.0, suggested)), 1), "Add a little speed", "The last delivery was marked slow. Keep the same line and return to your normal tempo without rushing the approach."
    if current.delivery_quality == "fast":
        suggested = baseline if baseline is not None else current.speed_mph - 0.5
        return round(max(5.0, min(30.0, suggested)), 1), "Smooth the speed down", "The last delivery was marked fast. Use a smoother first step and match your normal release tempo."
    if baseline is not None and abs(current.speed_mph - baseline) > 0.8:
        return round(max(5.0, min(30.0, baseline)), 1), "Return to your recent average", "The last shot was noticeably different from your recent speed. Match the recent average before making another large lane move."
    return round(current.speed_mph, 1), "Hold this speed", "The last speed is close to your recent tempo. Repeat it and let the lane adjustment do the work."


def recommend(shots: list[ShotLike], handedness: str) -> RecommendationResult:
    if not shots:
        return RecommendationResult(0, 0, "hold", "baseline", 0.35, "Establish a baseline", "Log a controlled shot before making a lane adjustment.")

    current = shots[-1]
    leave = _parse_leave(getattr(current, "leave_code", None))
    if leave and getattr(current, "pinfall", 10) < 10 and _is_first_ball_of_frame(shots):
        return _spare_plan(current, leave)

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
        return RecommendationResult(0, 0, "hold", "execution check", 0.82, "Repeat the shot", "The delivery was marked as an execution miss. Hold the line and repeat it before changing your feet or target.", **approach)

    if current.delivery_quality in {"slow", "fast"}:
        return RecommendationResult(0, 0, "hold", "approach tempo", 0.78, "Keep the lane line", "The main change should be your starting distance and tempo, not the lateral lane line. Verify the approach adjustment with one shot.", **approach)

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
        return RecommendationResult(0, 0, "hold", "hold", 0.86, "Stay on this line", f"The ball finished inside the acceptable pocket window.{speed_note}", **approach)

    direction = "high" if current_error > 0 else "light"
    same_direction = [err for err in normalized_errors[-3:] if (err > 0) == (current_error > 0) and abs(err) > 0.55]
    persistent = len(same_direction) >= 2
    avg_error = mean(normalized_errors[-3:]) if normalized_errors else current_error

    move_sign = inside_sign if direction == "high" else -inside_sign
    magnitude = 3 if abs(avg_error) > 1.8 and persistent else 2
    target_magnitude = 2 if magnitude == 3 else 1

    if not persistent:
        label = "left" if move_sign > 0 else "right"
        return RecommendationResult(0, 0, "hold", "confirm trend", 0.55, "Confirm the reaction once", f"This controlled shot finished {direction}. Repeat the same line once. If it repeats, prepare for a {magnitude}-and-{target_magnitude} move {label}.", **approach)

    feet_delta = magnitude * move_sign
    target_delta = target_magnitude * move_sign
    label = "left" if move_sign > 0 else "right"
    confidence = min(0.94, 0.68 + 0.08 * len(same_direction) + min(abs(avg_error), 2.5) * 0.04)
    return RecommendationResult(feet_delta, target_delta, label, f"{magnitude}-and-{target_magnitude} angular move", round(confidence, 2), f"Move {magnitude} boards {label}", f"Your recent controlled shots repeatedly finished {direction}. Move your feet {magnitude} boards {label} and your target {target_magnitude} board{'s' if target_magnitude != 1 else ''} {label}, then verify the reaction with one shot.", **approach)
