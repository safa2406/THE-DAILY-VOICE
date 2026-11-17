"""Add actual listening time tracking columns to listening_history

Revision ID: f1b36925cd33
Revises: e9a25814bf22
Create Date: 2026-11-18 00:05:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f1b36925cd33'
down_revision = 'e9a25814bf22'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_columns = [c['name'] for c in inspector.get_columns('listening_history')]

    with op.batch_alter_table('listening_history', schema=None) as batch_op:
        if 'total_listened_seconds' not in existing_columns:
            batch_op.add_column(sa.Column('total_listened_seconds', sa.Float(), server_default='0.0', nullable=False))
        if 'daily_listened_seconds' not in existing_columns:
            batch_op.add_column(sa.Column('daily_listened_seconds', sa.Float(), server_default='0.0', nullable=False))
        if 'daily_listened_date' not in existing_columns:
            batch_op.add_column(sa.Column('daily_listened_date', sa.String(length=10), nullable=True))
            batch_op.create_index(batch_op.f('ix_listening_history_daily_listened_date'), ['daily_listened_date'], unique=False)


def downgrade():
    with op.batch_alter_table('listening_history', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_listening_history_daily_listened_date'))
        batch_op.drop_column('daily_listened_date')
        batch_op.drop_column('daily_listened_seconds')
        batch_op.drop_column('total_listened_seconds')
