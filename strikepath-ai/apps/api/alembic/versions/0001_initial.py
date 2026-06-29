"""Initial StrikePath AI schema.

Revision ID: 0001
Revises:
"""
from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(512), nullable=False),
        sa.Column("display_name", sa.String(120), nullable=False),
        sa.Column("handedness", sa.String(10), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_table(
        "bowling_balls",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("manufacturer", sa.String(120), nullable=False),
        sa.Column("model", sa.String(160), nullable=False),
        sa.Column("weight_lb", sa.Float(), nullable=False),
        sa.Column("coverstock", sa.String(80), nullable=False),
        sa.Column("surface_grit", sa.Integer(), nullable=True),
        sa.Column("rg", sa.Float(), nullable=True),
        sa.Column("differential", sa.Float(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_primary", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_bowling_balls_user_id", "bowling_balls", ["user_id"])
    op.create_table(
        "bowling_sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("center_name", sa.String(160), nullable=False),
        sa.Column("lane_number", sa.String(30), nullable=True),
        sa.Column("oil_pattern_name", sa.String(160), nullable=False),
        sa.Column("oil_length_ft", sa.Float(), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_bowling_sessions_user_id", "bowling_sessions", ["user_id"])
    op.create_index("ix_bowling_sessions_status", "bowling_sessions", ["status"])
    op.create_table(
        "shots",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("session_id", sa.Integer(), sa.ForeignKey("bowling_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ball_id", sa.Integer(), sa.ForeignKey("bowling_balls.id", ondelete="SET NULL"), nullable=True),
        sa.Column("sequence_number", sa.Integer(), nullable=False),
        sa.Column("game_number", sa.Integer(), nullable=False),
        sa.Column("frame_number", sa.Integer(), nullable=True),
        sa.Column("feet_board", sa.Float(), nullable=False),
        sa.Column("laydown_board", sa.Float(), nullable=False),
        sa.Column("target_board", sa.Float(), nullable=False),
        sa.Column("breakpoint_board", sa.Float(), nullable=False),
        sa.Column("pocket_board", sa.Float(), nullable=False),
        sa.Column("speed_mph", sa.Float(), nullable=True),
        sa.Column("rev_rate", sa.Integer(), nullable=True),
        sa.Column("axis_rotation", sa.Float(), nullable=True),
        sa.Column("axis_tilt", sa.Float(), nullable=True),
        sa.Column("pinfall", sa.Integer(), nullable=False),
        sa.Column("leave_code", sa.String(80), nullable=True),
        sa.Column("delivery_quality", sa.String(40), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_shots_session_id", "shots", ["session_id"])
    op.create_table(
        "recommendations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("shot_id", sa.Integer(), sa.ForeignKey("shots.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("feet_delta", sa.Float(), nullable=False),
        sa.Column("target_delta", sa.Float(), nullable=False),
        sa.Column("direction_label", sa.String(40), nullable=False),
        sa.Column("adjustment_type", sa.String(80), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("title", sa.String(180), nullable=False),
        sa.Column("explanation", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("recommendations")
    op.drop_index("ix_shots_session_id", table_name="shots")
    op.drop_table("shots")
    op.drop_index("ix_bowling_sessions_status", table_name="bowling_sessions")
    op.drop_index("ix_bowling_sessions_user_id", table_name="bowling_sessions")
    op.drop_table("bowling_sessions")
    op.drop_index("ix_bowling_balls_user_id", table_name="bowling_balls")
    op.drop_table("bowling_balls")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
