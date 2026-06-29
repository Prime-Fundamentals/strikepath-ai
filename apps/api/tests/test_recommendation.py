from dataclasses import dataclass

from app.services.recommendation import recommend


@dataclass
class Shot:
    pocket_board: float
    target_board: float = 10
    feet_board: float = 25
    speed_mph: float | None = 16.5
    delivery_quality: str = "good"


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
