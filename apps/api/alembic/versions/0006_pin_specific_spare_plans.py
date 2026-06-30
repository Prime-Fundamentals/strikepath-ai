"""add pin-specific spare plan fields

Revision ID: 0006
Revises: 0005
Create Date: 2026-06-30
"""

from alembic import op
import sqlalchemy as sa

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("recommendations", sa.Column("shot_plan_type", sa.String(length=30), nullable=False, server_default="strike"))
    op.add_column("recommendations", sa.Column("leave_pins", sa.String(length=80), nullable=True))
    op.add_column("recommendations", sa.Column("suggested_feet_board", sa.Float(), nullable=True))
    op.add_column("recommendations", sa.Column("suggested_laydown_board", sa.Float(), nullable=True))
    op.add_column("recommendations", sa.Column("suggested_target_board", sa.Float(), nullable=True))
    op.add_column("recommendations", sa.Column("suggested_breakpoint_board", sa.Float(), nullable=True))
    op.add_column("recommendations", sa.Column("suggested_pocket_board", sa.Float(), nullable=True))
    op.add_column("recommendations", sa.Column("recommended_ball_type", sa.String(length=30), nullable=False, server_default="current"))


def downgrade() -> None:
    op.drop_column("recommendations", "recommended_ball_type")
    op.drop_column("recommendations", "suggested_pocket_board")
    op.drop_column("recommendations", "suggested_breakpoint_board")
    op.drop_column("recommendations", "suggested_target_board")
    op.drop_column("recommendations", "suggested_laydown_board")
    op.drop_column("recommendations", "suggested_feet_board")
    op.drop_column("recommendations", "leave_pins")
    op.drop_column("recommendations", "shot_plan_type")
