"""Explainable bowling-coaching knowledge used by StrikePath recommendations.

The rules in this module intentionally stay deterministic and inspectable. They
combine USBC adjustment concepts (parallel moves, 2-and-1 angular moves and the
3-6-9 spare system), Kegel's pattern-length-minus-31 starting-point concept,
and USBC/IBPSIA pocket and entry-angle guidance.
"""

from dataclasses import dataclass
from math import atan2, pi
from typing import Protocol


class BallLike(Protocol):
    coverstock: str
    surface_grit: int | None
    rg: float | None
    differential: float | None


BOARD_WIDTH_IN = 41.5 / 39
IDEAL_POCKET_DISPLAY = 17.5


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def display_board(physical_board: float, handedness: str) -> float:
    return 40.0 - physical_board if handedness == "left" else physical_board


def physical_board(display_value: float, handedness: str) -> float:
    value = clamp(display_value, 1.0, 39.0)
    return 40.0 - value if handedness == "left" else value


def physical_delta(display_delta: float, handedness: str) -> float:
    return -display_delta if handedness == "left" else display_delta


def cover_strength(ball: BallLike | None) -> float:
    if ball is None:
        return 0.58
    value = (ball.coverstock or "").lower()
    if "plastic" in value or "polyester" in value:
        base = 0.08
    elif "urethane" in value:
        base = 0.30
    elif "pearl" in value:
        base = 0.58
    elif "hybrid" in value:
        base = 0.72
    elif "solid" in value:
        base = 0.86
    elif "reactive" in value:
        base = 0.68
    else:
        base = 0.55

    if ball.surface_grit:
        base += clamp((4000 - ball.surface_grit) / 7000, -0.12, 0.28)
    if ball.differential is not None:
        base += clamp((ball.differential - 0.035) * 5.0, -0.10, 0.15)
    return clamp(base, 0.05, 1.15)


def exit_board_display(oil_length_ft: float) -> float:
    """Pattern-length-minus-31 starting estimate, limited to practical boards."""
    return clamp(oil_length_ft - 31.0, 4.0, 16.0)


@dataclass(frozen=True)
class StrikeLine:
    feet_display: float
    laydown_display: float
    target_display: float
    breakpoint_display: float
    pocket_display: float
    speed_mph: float
    entry_angle_deg: float


def estimate_entry_angle(breakpoint_display: float, pocket_display: float = IDEAL_POCKET_DISPLAY, run_ft: float = 16.0) -> float:
    lateral_inches = abs(pocket_display - breakpoint_display) * BOARD_WIDTH_IN
    return atan2(lateral_inches, run_ft * 12.0) * 180.0 / pi


def baseline_strike_line(
    handedness: str,
    oil_length_ft: float,
    speed_mph: float | None,
    rev_rate: int | None,
    ball: BallLike | None,
) -> StrikeLine:
    speed = speed_mph or 16.5
    revs = rev_rate or 320
    strength = cover_strength(ball)

    # Higher rev/stronger-cover players generally need a little more inside
    # launch room. Higher-speed/lower-rev players start slightly straighter.
    release_bias = clamp((revs - 320) / 220, -0.9, 1.1)
    speed_bias = clamp((16.5 - speed) / 2.8, -0.8, 0.8)
    equipment_bias = clamp((strength - 0.58) * 2.1, -1.0, 1.2)
    inside_bias = clamp(release_bias + speed_bias + equipment_bias, -1.5, 2.2)

    breakpoint = clamp(exit_board_display(oil_length_ft) + inside_bias * 0.45, 4.0, 18.0)
    target = clamp(breakpoint + 4.5 + inside_bias * 0.55, 7.0, 24.0)
    laydown = clamp(target + 9.0 + inside_bias * 0.75, 14.0, 34.0)
    feet = clamp(laydown + 3.0, 17.0, 38.0)
    entry = estimate_entry_angle(breakpoint)

    return StrikeLine(
        feet_display=round(feet, 2),
        laydown_display=round(laydown, 2),
        target_display=round(target, 2),
        breakpoint_display=round(breakpoint, 2),
        pocket_display=IDEAL_POCKET_DISPLAY,
        speed_mph=round(speed, 1),
        entry_angle_deg=round(entry, 1),
    )


@dataclass(frozen=True)
class AdjustmentMove:
    feet_display_delta: float
    target_display_delta: float
    adjustment_type: str
    label: str


def choose_lane_move(pocket_error: float, breakpoint_error: float) -> AdjustmentMove:
    """Return a concrete move after one trusted shot; larger repeats increase confidence elsewhere."""
    direction = 1.0 if pocket_error > 0 else -1.0  # + is deeper/inside in bowler-facing numbering.
    magnitude = abs(pocket_error)

    if magnitude <= 0.60:
        return AdjustmentMove(0.0, 0.0, "hold", "hold")

    # If the breakpoint itself missed the intended exit board significantly,
    # a parallel move is easier to understand and preserves launch shape.
    if abs(breakpoint_error) >= 2.0 and (breakpoint_error > 0) == (pocket_error > 0):
        move = 1.0 if magnitude < 1.8 else 2.0
        return AdjustmentMove(direction * move, direction * move, "parallel move", f"{int(move)}-and-{int(move)}")

    if magnitude < 1.25:
        return AdjustmentMove(direction, direction, "fine parallel move", "1-and-1")
    if magnitude < 2.35:
        return AdjustmentMove(direction * 2.0, direction, "2-and-1 angular move", "2-and-1")
    return AdjustmentMove(direction * 3.0, direction * 2.0, "3-and-2 angular move", "3-and-2")


HIGH_LEAVE_BY_HAND = {
    "right": {4},
    "left": {6},
}
LIGHT_LEAVE_BY_HAND = {
    "right": {2, 8},
    "left": {3, 9},
}


def leave_reaction_hint(leave: list[int], handedness: str) -> str | None:
    leave_set = set(leave)
    if len(leave_set) == 1 and leave_set & HIGH_LEAVE_BY_HAND.get(handedness, set()):
        return "high"
    if leave_set and leave_set.issubset(LIGHT_LEAVE_BY_HAND.get(handedness, set())):
        return "light"
    return None


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


@dataclass(frozen=True)
class SpareGeometry:
    lead_pin: int
    finish_board: float
    feet_board: float
    laydown_board: float
    target_board: float
    breakpoint_board: float
    split: bool
    single: bool


def spare_geometry(leave: list[int]) -> SpareGeometry:
    leave_set = frozenset(leave)
    split = leave_set in COMMON_SPLITS
    single = len(leave) == 1
    front_row = min(PIN_ROW[pin] for pin in leave)
    front_pins = [pin for pin in leave if PIN_ROW[pin] == front_row]
    center_board = sum(PIN_BOARD[pin] for pin in leave) / len(leave)
    lead_pin = min(front_pins, key=lambda pin: abs(PIN_BOARD[pin] - center_board))
    lead_board = PIN_BOARD[lead_pin]

    carry_adjustment = 0.0 if single else clamp((center_board - lead_board) * 0.28, -1.25, 1.25)
    finish = clamp(lead_board + carry_adjustment, 1.0, 39.0)

    # Straight cross-lane geometry that approximates a 3-6-9-style spare
    # system while still aiming at the exact key pin / cluster center.
    feet = clamp(20.0 + (20.0 - finish) * 0.82, 1.0, 39.0)
    laydown = clamp(feet + (finish - feet) * 0.07, 1.0, 39.0)
    target = clamp(feet + (finish - feet) * 0.28, 1.0, 39.0)
    breakpoint = clamp(feet + (finish - feet) * 0.72, 1.0, 39.0)

    return SpareGeometry(
        lead_pin=lead_pin,
        finish_board=round(finish, 2),
        feet_board=round(feet, 2),
        laydown_board=round(laydown, 2),
        target_board=round(target, 2),
        breakpoint_board=round(breakpoint, 2),
        split=split,
        single=single,
    )
