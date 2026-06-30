"""Add AR tracking captures.

Revision ID: 0002
Revises: 0001
"""
from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ar_tracking_captures",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("session_id", sa.Integer(), sa.ForeignKey("bowling_sessions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("source_type", sa.String(30), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("device_label", sa.String(180), nullable=True),
        sa.Column("calibration_points", sa.JSON(), nullable=False),
        sa.Column("path_points", sa.JSON(), nullable=False),
        sa.Column("derived_boards", sa.JSON(), nullable=False),
        sa.Column("media_duration_sec", sa.Float(), nullable=True),
        sa.Column("media_key", sa.String(500), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_ar_tracking_captures_user_id", "ar_tracking_captures", ["user_id"])
    op.create_index("ix_ar_tracking_captures_session_id", "ar_tracking_captures", ["session_id"])
    op.create_index("ix_ar_tracking_captures_status", "ar_tracking_captures", ["status"])


def downgrade() -> None:
    op.drop_index("ix_ar_tracking_captures_status", table_name="ar_tracking_captures")
    op.drop_index("ix_ar_tracking_captures_session_id", table_name="ar_tracking_captures")
    op.drop_index("ix_ar_tracking_captures_user_id", table_name="ar_tracking_captures")
    op.drop_table("ar_tracking_captures")
