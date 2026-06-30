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
    delivery_quality: str = "good"
    feet_depth_ft: float = 11.5
    pinfall: int = 10
    leave_code: str | None = None
    game_number: int = 1
    frame_number: int | None = 1


def test_right_hander_repeated_high_move_left():
    result = recommend([Shot(19.0), Shot(18.8)], "right")
    assert result.feet_delta > 0
    assert result.target_delta > 0
    assert result.direction_label == "left"


def test_left_hander_repeated_high_move_right():
    result = recommend([Shot(21.0), Shot(21.1)], "left")
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


def test_slow_delivery_suggests_recent_speed():
    result = recommend([
        Shot(17.5, speed_mph=16.5),
        Shot(17.5, speed_mph=16.4),
        Shot(17.5, speed_mph=15.2, delivery_quality="slow"),
    ], "right")
    assert result.suggested_speed_mph == 16.4 or result.suggested_speed_mph == 16.5
    assert "speed" in result.speed_title.lower()


def test_good_delivery_holds_speed():
    result = recommend([Shot(17.5, speed_mph=16.7)], "right")
    assert result.suggested_speed_mph == 16.7
    assert result.speed_title == "Hold this speed"


def test_single_ten_pin_creates_spare_plan():
    shot = Shot(17.5)
    shot.leave_code = "10"
    shot.pinfall = 9
    shot.frame_number = 1
    shot.game_number = 1
    shot.laydown_board = 22
    shot.breakpoint_board = 8
    result = recommend([shot], "right")
    assert result.shot_plan_type == "spare"
    assert result.leave_pins == "10"
    assert result.suggested_pocket_board is not None
    assert result.suggested_pocket_board < 6
    assert result.recommended_ball_type == "spare"


def test_second_ball_does_not_create_third_spare_plan():
    first = Shot(17.5)
    first.leave_code = "10"
    first.pinfall = 9
    first.frame_number = 1
    first.game_number = 1
    first.laydown_board = 22
    first.breakpoint_board = 8
    second = Shot(17.5)
    second.leave_code = "10"
    second.pinfall = 0
    second.frame_number = 1
    second.game_number = 1
    second.laydown_board = 28
    second.breakpoint_board = 8
    result = recommend([first, second], "right")
    assert result.shot_plan_type == "strike"
