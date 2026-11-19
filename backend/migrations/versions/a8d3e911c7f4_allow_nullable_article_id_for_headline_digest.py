"""Allow nullable article_id for edition-level headline digests

Revision ID: a8d3e911c7f4
Revises: f1b36925cd33
Create Date: 2026-11-19 12:15:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a8d3e911c7f4'
down_revision = 'f1b36925cd33'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('listening_history', schema=None) as batch_op:
        batch_op.alter_column(
            'article_id',
            existing_type=sa.Uuid(as_uuid=False),
            nullable=True,
        )


def downgrade():
    with op.batch_alter_table('listening_history', schema=None) as batch_op:
        batch_op.alter_column(
            'article_id',
            existing_type=sa.Uuid(as_uuid=False),
            nullable=False,
        )
