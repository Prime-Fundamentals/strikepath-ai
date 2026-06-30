"""Add shot handedness and approach-depth recommendations.

Revision ID: 0004
Revises: 0003
"""
from alembic import op
import sqlalchemy as sa

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("shots", sa.Column("handedness", sa.String(10), nullable=False, server_default="right"))
    op.add_column("shots", sa.Column("feet_depth_ft", sa.Float(), nullable=False, server_default="11.5"))
    op.add_column("recommendations", sa.Column("feet_depth_delta_ft", sa.Float(), nullable=False, server_default="0"))
    op.add_column("recommendations", sa.Column("suggested_feet_depth_ft", sa.Float(), nullable=False, server_default="11.5"))
    op.add_column("recommendations", sa.Column("approach_title", sa.String(180), nullable=False, server_default="Hold your approach depth"))
    op.add_column("recommendations", sa.Column("approach_explanation", sa.Text(), nullable=False, server_default="Keep the same starting depth and tempo."))


def downgrade() -> None:
    op.drop_column("recommendations", "approach_explanation")
    op.drop_column("recommendations", "approach_title")
    op.drop_column("recommendations", "suggested_feet_depth_ft")
    op.drop_column("recommendations", "feet_depth_delta_ft")
    op.drop_column("shots", "feet_depth_ft")
    op.drop_column("shots", "handedness")
