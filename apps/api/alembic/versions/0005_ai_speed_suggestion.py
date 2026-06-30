"""add AI speed suggestion fields

Revision ID: 0005
Revises: 0004
Create Date: 2026-06-30
"""

from alembic import op
import sqlalchemy as sa

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("recommendations", sa.Column("suggested_speed_mph", sa.Float(), nullable=True))
    op.add_column("recommendations", sa.Column("speed_title", sa.String(length=180), nullable=False, server_default="Hold your speed"))
    op.add_column("recommendations", sa.Column("speed_explanation", sa.Text(), nullable=False, server_default="Repeat the same smooth tempo."))


def downgrade() -> None:
    op.drop_column("recommendations", "speed_explanation")
    op.drop_column("recommendations", "speed_title")
    op.drop_column("recommendations", "suggested_speed_mph")
