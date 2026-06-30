from dataclasses import dataclass

from app.services.recommendation import recommend


@dataclass
class Shot:
    pocket_board: float
    target_board: float = 10
    feet_board: float = 25
    speed_mph: float | None = 16.5
    delivery_quality: str = "good"
    feet_depth_ft: float = 11.5


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
