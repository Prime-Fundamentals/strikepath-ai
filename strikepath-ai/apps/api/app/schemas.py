from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

Handedness = Literal["right", "left"]
DeliveryQuality = Literal["good", "unknown", "missed_left", "missed_right", "pulled", "slow", "fast"]


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(min_length=2, max_length=120)
    handedness: Handedness = "right"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: EmailStr
    display_name: str
    handedness: Handedness
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead


class BallCreate(BaseModel):
    manufacturer: str = Field(min_length=1, max_length=120)
    model: str = Field(min_length=1, max_length=160)
    weight_lb: float = Field(default=15.0, ge=6, le=16)
    coverstock: str = Field(default="reactive solid", max_length=80)
    surface_grit: int | None = Field(default=None, ge=180, le=10000)
    rg: float | None = Field(default=None, ge=2.0, le=3.0)
    differential: float | None = Field(default=None, ge=0, le=0.1)
    notes: str | None = Field(default=None, max_length=2000)
    is_primary: bool = False


class BallUpdate(BallCreate):
    pass


class BallRead(BallCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    created_at: datetime


class SessionCreate(BaseModel):
    center_name: str = Field(default="Practice Center", max_length=160)
    lane_number: str | None = Field(default=None, max_length=30)
    oil_pattern_name: str = Field(default="Typical House Shot", max_length=160)
    oil_length_ft: float = Field(default=41, ge=20, le=60)
    notes: str | None = Field(default=None, max_length=3000)


class SessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    center_name: str
    lane_number: str | None
    oil_pattern_name: str
    oil_length_ft: float
    status: str
    notes: str | None
    started_at: datetime
    ended_at: datetime | None
    shot_count: int = 0


class RecommendationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int | None = None
    feet_delta: float
    target_delta: float
    direction_label: str
    adjustment_type: str
    confidence: float
    title: str
    explanation: str


class ShotCreate(BaseModel):
    ball_id: int | None = None
    game_number: int = Field(default=1, ge=1, le=20)
    frame_number: int | None = Field(default=None, ge=1, le=12)
    feet_board: float = Field(ge=1, le=39)
    laydown_board: float = Field(ge=1, le=39)
    target_board: float = Field(ge=1, le=39)
    breakpoint_board: float = Field(ge=1, le=39)
    pocket_board: float = Field(ge=1, le=39)
    speed_mph: float | None = Field(default=None, ge=5, le=30)
    rev_rate: int | None = Field(default=None, ge=0, le=800)
    axis_rotation: float | None = Field(default=None, ge=0, le=180)
    axis_tilt: float | None = Field(default=None, ge=0, le=90)
    pinfall: int = Field(default=10, ge=0, le=10)
    leave_code: str | None = Field(default=None, max_length=80)
    delivery_quality: DeliveryQuality = "good"
    notes: str | None = Field(default=None, max_length=2000)


class ShotRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    session_id: int
    ball_id: int | None
    sequence_number: int
    game_number: int
    frame_number: int | None
    feet_board: float
    laydown_board: float
    target_board: float
    breakpoint_board: float
    pocket_board: float
    speed_mph: float | None
    rev_rate: int | None
    axis_rotation: float | None
    axis_tilt: float | None
    pinfall: int
    leave_code: str | None
    delivery_quality: str
    notes: str | None
    created_at: datetime
    recommendation: RecommendationRead | None = None


class SessionDetail(SessionRead):
    shots: list[ShotRead]


class DashboardRead(BaseModel):
    active_session: SessionRead | None
    total_sessions: int
    total_shots: int
    strike_rate: float
    pocket_rate: float
    arsenal_count: int
    recent_sessions: list[SessionRead]


class AnalyticsRead(BaseModel):
    session_id: int
    shot_count: int
    strike_rate: float
    pocket_rate: float
    average_pinfall: float
    average_speed: float | None
    target_accuracy: float
    adjustment_success_rate: float
    board_miss_average: float
    games: list[dict]


class LaneStateRead(BaseModel):
    boards: int = 39
    zones: int
    friction_grid: list[list[float]]
    paths: list[dict]
    description: str
