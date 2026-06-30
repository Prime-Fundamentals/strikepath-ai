from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(512))
    display_name: Mapped[str] = mapped_column(String(120))
    handedness: Mapped[str] = mapped_column(String(10), default="right")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    balls: Mapped[list[BowlingBall]] = relationship(back_populates="owner", cascade="all, delete-orphan")
    sessions: Mapped[list[BowlingSession]] = relationship(back_populates="owner", cascade="all, delete-orphan")
    ar_captures: Mapped[list[ARTrackingCapture]] = relationship(back_populates="owner", cascade="all, delete-orphan")


class BowlingBall(Base):
    __tablename__ = "bowling_balls"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    manufacturer: Mapped[str] = mapped_column(String(120))
    model: Mapped[str] = mapped_column(String(160))
    weight_lb: Mapped[float] = mapped_column(Float, default=15.0)
    coverstock: Mapped[str] = mapped_column(String(80), default="reactive solid")
    surface_grit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rg: Mapped[float | None] = mapped_column(Float, nullable=True)
    differential: Mapped[float | None] = mapped_column(Float, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    owner: Mapped[User] = relationship(back_populates="balls")
    shots: Mapped[list[Shot]] = relationship(back_populates="ball")


class BowlingSession(Base):
    __tablename__ = "bowling_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    center_name: Mapped[str] = mapped_column(String(160), default="Practice Center")
    lane_number: Mapped[str | None] = mapped_column(String(30), nullable=True)
    oil_pattern_name: Mapped[str] = mapped_column(String(160), default="Typical House Shot")
    oil_length_ft: Mapped[float] = mapped_column(Float, default=41.0)
    status: Mapped[str] = mapped_column(String(30), default="active", index=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    owner: Mapped[User] = relationship(back_populates="sessions")
    shots: Mapped[list[Shot]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="Shot.sequence_number",
    )
    ar_captures: Mapped[list[ARTrackingCapture]] = relationship(back_populates="session", cascade="all, delete-orphan")


class Shot(Base):
    __tablename__ = "shots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("bowling_sessions.id", ondelete="CASCADE"), index=True)
    ball_id: Mapped[int | None] = mapped_column(ForeignKey("bowling_balls.id", ondelete="SET NULL"), nullable=True)
    sequence_number: Mapped[int] = mapped_column(Integer)
    game_number: Mapped[int] = mapped_column(Integer, default=1)
    frame_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    feet_board: Mapped[float] = mapped_column(Float)
    laydown_board: Mapped[float] = mapped_column(Float)
    target_board: Mapped[float] = mapped_column(Float)
    breakpoint_board: Mapped[float] = mapped_column(Float)
    pocket_board: Mapped[float] = mapped_column(Float)
    speed_mph: Mapped[float | None] = mapped_column(Float, nullable=True)
    rev_rate: Mapped[int | None] = mapped_column(Integer, nullable=True)
    axis_rotation: Mapped[float | None] = mapped_column(Float, nullable=True)
    axis_tilt: Mapped[float | None] = mapped_column(Float, nullable=True)
    pinfall: Mapped[int] = mapped_column(Integer, default=10)
    leave_code: Mapped[str | None] = mapped_column(String(80), nullable=True)
    delivery_quality: Mapped[str] = mapped_column(String(40), default="good")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    session: Mapped[BowlingSession] = relationship(back_populates="shots")
    ball: Mapped[BowlingBall | None] = relationship(back_populates="shots")
    recommendation: Mapped[Recommendation | None] = relationship(
        back_populates="shot", cascade="all, delete-orphan", uselist=False
    )


class Recommendation(Base):
    __tablename__ = "recommendations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    shot_id: Mapped[int] = mapped_column(ForeignKey("shots.id", ondelete="CASCADE"), unique=True)
    feet_delta: Mapped[float] = mapped_column(Float, default=0)
    target_delta: Mapped[float] = mapped_column(Float, default=0)
    direction_label: Mapped[str] = mapped_column(String(40), default="hold")
    adjustment_type: Mapped[str] = mapped_column(String(80), default="hold")
    confidence: Mapped[float] = mapped_column(Float, default=0.5)
    title: Mapped[str] = mapped_column(String(180))
    explanation: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    shot: Mapped[Shot] = relationship(back_populates="recommendation")


class ARTrackingCapture(Base):
    __tablename__ = "ar_tracking_captures"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    session_id: Mapped[int | None] = mapped_column(ForeignKey("bowling_sessions.id", ondelete="SET NULL"), nullable=True, index=True)
    source_type: Mapped[str] = mapped_column(String(30), default="camera")
    status: Mapped[str] = mapped_column(String(30), default="reviewed", index=True)
    device_label: Mapped[str | None] = mapped_column(String(180), nullable=True)
    calibration_points: Mapped[list[dict]] = mapped_column(JSON, default=list)
    path_points: Mapped[list[dict]] = mapped_column(JSON, default=list)
    derived_boards: Mapped[dict] = mapped_column(JSON, default=dict)
    tracking_mode: Mapped[str] = mapped_column(String(30), default="manual")
    tracking_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    auto_track_points: Mapped[list[dict]] = mapped_column(JSON, default=list)
    estimated_speed_mph: Mapped[float | None] = mapped_column(Float, nullable=True)
    estimated_entry_angle_deg: Mapped[float | None] = mapped_column(Float, nullable=True)
    media_duration_sec: Mapped[float | None] = mapped_column(Float, nullable=True)
    media_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    owner: Mapped[User] = relationship(back_populates="ar_captures")
    session: Mapped[BowlingSession | None] = relationship(back_populates="ar_captures")
