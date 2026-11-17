"""Add UserEdition table and extra ListeningHistory fields

Revision ID: e9a25814bf22
Revises: d8f13716eb51
Create Date: 2026-11-17 23:35:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e9a25814bf22'
down_revision = 'd8f13716eb51'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()

    # 1. Create user_editions table if it does not already exist
    if 'user_editions' not in existing_tables:
        op.create_table(
            'user_editions',
            sa.Column('id', sa.Uuid(as_uuid=False), nullable=False),
            sa.Column('user_id', sa.Uuid(as_uuid=False), nullable=False),
            sa.Column('edition_id', sa.Uuid(as_uuid=False), nullable=False),
            sa.Column('source', sa.String(length=50), server_default='qr_scan', nullable=False),
            sa.Column('acquired_at', sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(['edition_id'], ['editions.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('user_id', 'edition_id', name='uq_user_edition')
        )
        with op.batch_alter_table('user_editions', schema=None) as batch_op:
            batch_op.create_index(batch_op.f('ix_user_editions_edition_id'), ['edition_id'], unique=False)
            batch_op.create_index(batch_op.f('ix_user_editions_user_id'), ['user_id'], unique=False)

    # 2. Add edition_id, listening_mode, and language to listening_history if not present
    existing_columns = [c['name'] for c in inspector.get_columns('listening_history')]
    with op.batch_alter_table('listening_history', schema=None) as batch_op:
        if 'edition_id' not in existing_columns:
            batch_op.add_column(sa.Column('edition_id', sa.Uuid(as_uuid=False), nullable=True))
            batch_op.create_foreign_key('fk_listening_history_edition_id', 'editions', ['edition_id'], ['id'], ondelete='CASCADE')
            batch_op.create_index(batch_op.f('ix_listening_history_edition_id'), ['edition_id'], unique=False)
        if 'listening_mode' not in existing_columns:
            batch_op.add_column(sa.Column('listening_mode', sa.String(length=32), server_default='summary', nullable=False))
        if 'language' not in existing_columns:
            batch_op.add_column(sa.Column('language', sa.String(length=32), server_default='English', nullable=False))


def downgrade():
    with op.batch_alter_table('listening_history', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_listening_history_edition_id'))
        batch_op.drop_constraint('fk_listening_history_edition_id', type_='foreignkey')
        batch_op.drop_column('language')
        batch_op.drop_column('listening_mode')
        batch_op.drop_column('edition_id')

    with op.batch_alter_table('user_editions', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_user_editions_user_id'))
        batch_op.drop_index(batch_op.f('ix_user_editions_edition_id'))

    op.drop_table('user_editions')
