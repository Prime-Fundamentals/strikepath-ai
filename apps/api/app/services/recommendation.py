from dataclasses import dataclass
from statistics import mean
from typing import Protocol

from .pro_bowler_knowledge import (
    IDEAL_POCKET_DISPLAY,
    BallLike,
    baseline_strike_line,
    choose_lane_move,
    clamp,
    display_board,
    exit_board_display,
    leave_reaction_hint,
    physical_board,
    physical_delta,
    spare_geometry,
)


class ShotLike(Protocol):
    pocket_board: float
    target_board: float
    feet_board: float
    laydown_board: float
    breakpoint_board: float
    feet_depth_ft: float
    speed_mph: float | None
    rev_rate: int | None
    axis_rotation: float | None
    axis_tilt: float | None
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


def _is_first_ball_of_frame(shots: list[ShotLike]) -> bool:
    if len(shots) < 2:
        return True
    current = shots[-1]
    previous = shots[-2]
    current_frame = getattr(current, "frame_number", None)
    previous_frame = getattr(previous, "frame_number", None)
    if current_frame is None or previous_frame is None:
        return True
    return current.game_number != previous.game_number or current_frame != previous_frame




def _is_second_ball_of_frame(shots: list[ShotLike]) -> bool:
    if len(shots) < 2:
        return False
    current = shots[-1]
    previous = shots[-2]
    same_frame = current.game_number == previous.game_number and current.frame_number == previous.frame_number
    previous_left_pins = getattr(previous, "pinfall", 10) < 10 and bool(getattr(previous, "leave_code", None))
    return same_frame and previous_left_pins

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
        return delta, suggested, "Start 6 inches farther back", "The last shot was slower than your recent tempo. Start about 6 inches farther from the foul line, keep the same number of steps, and maintain a smooth first step."

    if fast:
        delta = -0.5
        suggested = _clamp_depth(current_depth + delta)
        return delta, suggested, "Start 6 inches closer", "The last shot was faster than your recent tempo. Start about 6 inches closer to the foul line and smooth the first two steps instead of braking late."

    if current.delivery_quality in {"pulled", "missed_left", "missed_right"}:
        return 0, current_depth, "Hold the starting depth", "The miss was marked as execution-related. Keep the same approach depth and repeat the shot before changing your starting distance."

    return 0, current_depth, "Hold the starting depth", "Your recorded speed and execution do not justify a forward-or-backward move. Keep the same starting distance and repeat the tempo."


def _speed_advice(current: ShotLike, recent: list[ShotLike]) -> tuple[float | None, str, str]:
    speeds = [shot.speed_mph for shot in recent if shot.speed_mph is not None]
    previous = [shot.speed_mph for shot in recent[:-1] if shot.speed_mph is not None]
    baseline = mean(previous) if previous else (mean(speeds) if speeds else None)

    if current.speed_mph is None:
        return round(baseline, 1) if baseline is not None else None, "Use your normal smooth speed", "No speed was recorded. Keep a repeatable tempo rather than forcing extra speed."
    if current.delivery_quality == "slow":
        suggested = baseline if baseline is not None else current.speed_mph + 0.5
        return round(clamp(suggested, 5.0, 30.0), 1), "Return to normal speed", "The last delivery was marked slow. Return to your normal tempo without rushing the approach."
    if current.delivery_quality == "fast":
        suggested = baseline if baseline is not None else current.speed_mph - 0.5
        return round(clamp(suggested, 5.0, 30.0), 1), "Smooth the speed down", "The last delivery was marked fast. Use a smoother first step and match your normal release tempo."
    if baseline is not None and abs(current.speed_mph - baseline) > 0.8:
        return round(clamp(baseline, 5.0, 30.0), 1), "Return to your recent average", "The last shot differed noticeably from your recent speed. Match the recent average before making a larger lane move."
    return round(current.speed_mph, 1), "Hold this speed", "The last speed is close to your recent tempo. Repeat it and let the lane move do the work."


def _spare_plan(current: ShotLike, leave: list[int]) -> RecommendationResult:
    geometry = spare_geometry(leave)
    current_feet = getattr(current, "feet_board", geometry.feet_board)
    current_target = getattr(current, "target_board", geometry.target_board)
    depth = _clamp_depth(getattr(current, "feet_depth_ft", 11.5) or 11.5)
    current_speed = getattr(current, "speed_mph", None)
    speed = round(max(17.0, min(19.0, current_speed or 17.5)), 1)
    pin_text = "-".join(str(pin) for pin in leave)

    if geometry.single:
        title = f"Shoot the {geometry.lead_pin} pin"
        explanation = f"Use a direct cross-lane spare line through the center of the {geometry.lead_pin} pin. Keep the wrist quiet and roll the ball end-over-end."
        confidence = 0.93
    elif geometry.split:
        title = f"Attack the front pin of the {pin_text} split"
        explanation = f"Use the {geometry.lead_pin} pin as the key pin and shade slightly toward the remaining pins. Conversion odds are lower, so prioritize a clean hit on the lead pin."
        confidence = 0.48
    else:
        title = f"Convert the {pin_text} leave"
        explanation = f"Use the {geometry.lead_pin} pin as the key pin and drive it through the remaining cluster. The suggested line is straighter than the strike line to reduce over-hook."
        confidence = 0.80

    use_spare_ball = geometry.single or geometry.split or any(pin in {7, 10} for pin in leave)
    ball_type = "spare" if use_spare_ball else "current"
    ball_note = "Use a plastic/polyester spare ball if available." if use_spare_ball else "Your current ball is acceptable if you keep the release direct and controlled."

    return RecommendationResult(
        feet_delta=round(geometry.feet_board - current_feet, 2),
        target_delta=round(geometry.target_board - current_target, 2),
        direction_label="spare",
        adjustment_type="key-pin spare line",
        confidence=confidence,
        title=title,
        explanation=f"{explanation} {ball_note}",
        feet_depth_delta_ft=0,
        suggested_feet_depth_ft=round(depth, 2),
        approach_title="Keep the same approach length",
        approach_explanation="Use your normal approach length and a smooth, direct release. Let the cross-lane angle—not extra hook—create the spare path.",
        suggested_speed_mph=speed,
        speed_title=f"Use about {speed:.1f} mph",
        speed_explanation="A firm, repeatable spare speed helps keep the ball on a straighter line.",
        shot_plan_type="spare",
        leave_pins=pin_text,
        suggested_feet_board=geometry.feet_board,
        suggested_laydown_board=geometry.laydown_board,
        suggested_target_board=geometry.target_board,
        suggested_breakpoint_board=geometry.breakpoint_board,
        suggested_pocket_board=geometry.finish_board,
        recommended_ball_type=ball_type,
    )


def _ball_change_hint(current: ShotLike, pocket_error: float, ideal_exit: float, actual_exit: float, ball: BallLike | None) -> str:
    cover = (getattr(ball, "coverstock", "") or "").lower() if ball else ""
    early = actual_exit > ideal_exit + 1.5
    late = actual_exit < ideal_exit - 1.5
    if pocket_error > 1.2 and early and any(name in cover for name in {"solid", "hybrid", "reactive"}):
        return "weaker"
    if pocket_error < -1.2 and late:
        return "stronger"
    return "current"


def recommend(
    shots: list[ShotLike],
    handedness: str,
    oil_length_ft: float = 41.0,
    ball: BallLike | None = None,
) -> RecommendationResult:
    if not shots:
        baseline = baseline_strike_line(handedness, oil_length_ft, None, None, ball)
        return RecommendationResult(
            0,
            0,
            "baseline",
            "pattern starting line",
            0.45,
            "Start with a balanced strike line",
            "This is a pattern-based starting point. Confirm it with one controlled shot and let the result refine the next setup.",
            suggested_speed_mph=baseline.speed_mph,
            suggested_feet_board=physical_board(baseline.feet_display, handedness),
            suggested_laydown_board=physical_board(baseline.laydown_display, handedness),
            suggested_target_board=physical_board(baseline.target_display, handedness),
            suggested_breakpoint_board=physical_board(baseline.breakpoint_display, handedness),
            suggested_pocket_board=physical_board(baseline.pocket_display, handedness),
        )

    logged_current = shots[-1]
    leave = _parse_leave(getattr(logged_current, "leave_code", None))
    first_ball_now = not _is_second_ball_of_frame(shots)
    if leave and getattr(logged_current, "pinfall", 10) < 10 and first_ball_now:
        return _spare_plan(logged_current, leave)

    first_ball_shots: list[ShotLike] = []
    for index, shot in enumerate(shots):
        if index == 0:
            first_ball_shots.append(shot)
            continue
        previous = shots[index - 1]
        same_frame = shot.game_number == previous.game_number and shot.frame_number == previous.frame_number
        previous_left_pins = getattr(previous, "pinfall", 10) < 10 and bool(getattr(previous, "leave_code", None))
        if not (same_frame and previous_left_pins):
            first_ball_shots.append(shot)

    # After a spare attempt, the next recommendation must return to a strike
    # setup. Analyze the most recent first ball instead of treating the spare
    # line as a strike line.
    current = logged_current if first_ball_now else (first_ball_shots[-1] if first_ball_shots else logged_current)
    recent = first_ball_shots[-6:] if first_ball_shots else shots[-6:]
    trusted = [shot for shot in recent if _quality_is_trustworthy(shot.delivery_quality)]
    depth_delta, suggested_depth, approach_title, approach_explanation = _approach_advice(current, recent)
    suggested_speed, speed_title, speed_explanation = _speed_advice(current, recent)
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
        return RecommendationResult(0, 0, "hold", "execution check", 0.84, "Repeat the same setup", "The delivery was marked as an execution miss. Hold the lane line and repeat it before changing the feet or target.", **approach)

    if current.delivery_quality in {"slow", "fast"}:
        return RecommendationResult(0, 0, "hold", "approach tempo", 0.80, "Correct the tempo first", "Keep the lateral lane line for one more shot. Use the suggested speed and approach-depth correction before making a board move.", **approach)

    baseline = baseline_strike_line(
        handedness,
        oil_length_ft,
        current.speed_mph,
        getattr(current, "rev_rate", None),
        ball,
    )
    current_pocket_display = display_board(current.pocket_board, handedness)
    current_breakpoint_display = display_board(current.breakpoint_board, handedness)
    ideal_exit = baseline.breakpoint_display
    pocket_error = current_pocket_display - IDEAL_POCKET_DISPLAY
    breakpoint_error = current_breakpoint_display - ideal_exit

    leave_hint = leave_reaction_hint(leave, handedness)
    if abs(pocket_error) < 0.5 and leave_hint == "high":
        pocket_error = 0.8
    elif abs(pocket_error) < 0.5 and leave_hint == "light":
        pocket_error = -0.8

    move = choose_lane_move(pocket_error, breakpoint_error)
    current_feet_display = display_board(current.feet_board, handedness)
    current_laydown_display = display_board(current.laydown_board, handedness)
    current_target_display = display_board(current.target_board, handedness)

    # Move the observed line, then nudge the breakpoint toward the pattern-based
    # exit board by no more than one board so the recommendation stays practical.
    suggested_feet_display = clamp(current_feet_display + move.feet_display_delta, 1.0, 39.0)
    suggested_laydown_display = clamp(current_laydown_display + move.feet_display_delta, 1.0, 39.0)
    suggested_target_display = clamp(current_target_display + move.target_display_delta, 1.0, 39.0)
    breakpoint_nudge = clamp(ideal_exit - current_breakpoint_display, -1.0, 1.0)
    suggested_breakpoint_display = clamp(current_breakpoint_display + breakpoint_nudge, 1.0, 39.0)

    exact_fields = {
        "suggested_feet_board": round(physical_board(suggested_feet_display, handedness), 2),
        "suggested_laydown_board": round(physical_board(suggested_laydown_display, handedness), 2),
        "suggested_target_board": round(physical_board(suggested_target_display, handedness), 2),
        "suggested_breakpoint_board": round(physical_board(suggested_breakpoint_display, handedness), 2),
        "suggested_pocket_board": round(physical_board(IDEAL_POCKET_DISPLAY, handedness), 2),
    }

    if move.adjustment_type == "hold":
        return RecommendationResult(
            0,
            0,
            "hold",
            "hold",
            0.89 if len(trusted) >= 2 else 0.80,
            "Stay on this line",
            f"The ball finished within the pocket window. Your estimated pattern-exit board is {ideal_exit:.1f}; the recorded breakpoint was {current_breakpoint_display:.1f}. Repeat the setup and watch for a repeated change.",
            recommended_ball_type="current",
            **approach,
            **exact_fields,
        )

    direction_word = "inside" if move.feet_display_delta > 0 else "outside"
    reaction_word = "high" if pocket_error > 0 else "light"
    consistency = [
        display_board(shot.pocket_board, handedness) - IDEAL_POCKET_DISPLAY
        for shot in trusted[-3:]
    ]
    same_direction = [error for error in consistency if abs(error) > .6 and (error > 0) == (pocket_error > 0)]
    repeated = len(same_direction) >= 2
    confidence = 0.64 + min(abs(pocket_error), 2.5) * .07 + (0.13 if repeated else 0.0)
    confidence = round(clamp(confidence, 0.58, 0.95), 2)

    ball_type = _ball_change_hint(current, pocket_error, ideal_exit, current_breakpoint_display, ball)
    ball_sentence = {
        "weaker": "If this reaction repeats after the move, consider a cleaner or weaker ball.",
        "stronger": "If this reaction repeats after the move, consider a stronger or earlier-reading ball.",
        "current": "Keep the current ball for the verification shot.",
    }[ball_type]

    feet_delta_physical = physical_delta(move.feet_display_delta, handedness)
    target_delta_physical = physical_delta(move.target_display_delta, handedness)
    title = f"Move {abs(move.feet_display_delta):g} board{'s' if abs(move.feet_display_delta) != 1 else ''} {direction_word}"
    explanation = (
        f"The last trusted shot finished {reaction_word}. Use a {move.label} move: feet {abs(move.feet_display_delta):g} and target {abs(move.target_display_delta):g} board{'s' if abs(move.target_display_delta) != 1 else ''} {direction_word}. "
        f"The pattern-based exit estimate is board {ideal_exit:.1f}, so the suggested breakpoint is {suggested_breakpoint_display:.1f}. {ball_sentence}"
    )

    return RecommendationResult(
        feet_delta=round(feet_delta_physical, 2),
        target_delta=round(target_delta_physical, 2),
        direction_label="left" if feet_delta_physical > 0 else "right",
        adjustment_type=move.adjustment_type,
        confidence=confidence,
        title=title,
        explanation=explanation,
        recommended_ball_type=ball_type,
        **approach,
        **exact_fields,
    )
