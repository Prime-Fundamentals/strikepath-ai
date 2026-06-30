"""Add assisted AR tracking metadata.

Revision ID: 0003
Revises: 0002
"""
from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("ar_tracking_captures", sa.Column("tracking_mode", sa.String(30), nullable=False, server_default="manual"))
    op.add_column("ar_tracking_captures", sa.Column("tracking_confidence", sa.Float(), nullable=True))
    op.add_column("ar_tracking_captures", sa.Column("auto_track_points", sa.JSON(), nullable=False, server_default="[]"))
    op.add_column("ar_tracking_captures", sa.Column("estimated_speed_mph", sa.Float(), nullable=True))
    op.add_column("ar_tracking_captures", sa.Column("estimated_entry_angle_deg", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("ar_tracking_captures", "estimated_entry_angle_deg")
    op.drop_column("ar_tracking_captures", "estimated_speed_mph")
    op.drop_column("ar_tracking_captures", "auto_track_points")
    op.drop_column("ar_tracking_captures", "tracking_confidence")
    op.drop_column("ar_tracking_captures", "tracking_mode")
