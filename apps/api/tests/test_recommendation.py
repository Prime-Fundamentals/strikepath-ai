from dataclasses import dataclass

from app.services.recommendation import recommend


@dataclass
class Shot:
    pocket_board: float
    target_board: float = 10
    feet_board: float = 25
    laydown_board: float = 22
    breakpoint_board: float = 8
    speed_mph: float | None = 16.5
    rev_rate: int | None = 320
    axis_rotation: float | None = 45
    axis_tilt: float | None = 12
    delivery_quality: str = "good"
    feet_depth_ft: float = 11.5
    pinfall: int = 10
    leave_code: str | None = None
    game_number: int = 1
    frame_number: int | None = 1


@dataclass
class Ball:
    coverstock: str = "reactive solid"
    surface_grit: int | None = 2000
    rg: float | None = 2.50
    differential: float | None = 0.048


def test_right_hander_single_high_shot_gets_immediate_move_left():
    result = recommend([Shot(19.0)], "right", oil_length_ft=41, ball=Ball())
    assert result.feet_delta > 0
    assert result.target_delta > 0
    assert result.direction_label == "left"
    assert result.suggested_feet_board is not None


def test_left_hander_single_high_shot_gets_immediate_move_right():
    result = recommend([Shot(21.0, breakpoint_board=31.5)], "left", oil_length_ft=41, ball=Ball())
    assert result.feet_delta < 0
    assert result.direction_label == "right"


def test_execution_miss_holds_line():
    result = recommend([Shot(19.0, delivery_quality="pulled")], "right")
    assert result.feet_delta == 0
    assert result.adjustment_type == "execution check"


def test_slow_delivery_moves_approach_back():
    result = recommend([Shot(17.5, speed_mph=16.5), Shot(17.5, speed_mph=16.4), Shot(17.5, speed_mph=15.2, delivery_quality="slow")], "right")
    assert result.feet_depth_delta_ft > 0
    assert result.suggested_feet_depth_ft == 12.0


def test_fast_delivery_moves_approach_forward():
    result = recommend([Shot(17.5, speed_mph=16.0), Shot(17.5, speed_mph=16.1), Shot(17.5, speed_mph=17.4, delivery_quality="fast")], "right")
    assert result.feet_depth_delta_ft < 0
    assert result.suggested_feet_depth_ft == 11.0


def test_good_pocket_holds_and_returns_exact_setup():
    result = recommend([Shot(17.5, speed_mph=16.7, breakpoint_board=10)], "right", oil_length_ft=41)
    assert result.suggested_speed_mph == 16.7
    assert result.adjustment_type == "hold"
    assert result.suggested_pocket_board == 17.5


def test_pattern_length_changes_suggested_breakpoint():
    short = recommend([Shot(17.5, breakpoint_board=8)], "right", oil_length_ft=37)
    long = recommend([Shot(17.5, breakpoint_board=12)], "right", oil_length_ft=45)
    assert short.suggested_breakpoint_board is not None
    assert long.suggested_breakpoint_board is not None
    assert long.suggested_breakpoint_board > short.suggested_breakpoint_board


def test_single_ten_pin_creates_spare_plan():
    shot = Shot(17.5)
    shot.leave_code = "10"
    shot.pinfall = 9
    result = recommend([shot], "right")
    assert result.shot_plan_type == "spare"
    assert result.leave_pins == "10"
    assert result.suggested_pocket_board is not None
    assert result.suggested_pocket_board < 6
    assert result.recommended_ball_type == "spare"


def test_single_seven_pin_creates_cross_lane_plan():
    shot = Shot(17.5, leave_code="7", pinfall=9)
    result = recommend([shot], "right")
    assert result.shot_plan_type == "spare"
    assert result.suggested_pocket_board is not None
    assert result.suggested_pocket_board > 34
    assert result.suggested_feet_board is not None
    assert result.suggested_feet_board < 10


def test_second_ball_does_not_create_third_spare_plan():
    first = Shot(17.5, leave_code="10", pinfall=9, frame_number=1)
    second = Shot(17.5, leave_code="10", pinfall=0, frame_number=1)
    result = recommend([first, second], "right")
    assert result.shot_plan_type == "strike"
