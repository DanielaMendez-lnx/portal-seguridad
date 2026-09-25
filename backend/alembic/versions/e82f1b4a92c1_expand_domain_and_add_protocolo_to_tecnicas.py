"""expand_domain_and_add_protocolo_to_tecnicas

Revision ID: e82f1b4a92c1
Revises: 5846cd6bab33
Create Date: 2026-09-25 14:30:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'e82f1b4a92c1'
down_revision: Union[str, None] = '5846cd6bab33'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Ampliar tamaño de columna nombre en dominios y agregar slug
    op.alter_column('dominios', 'nombre', type_=sa.String(100), existing_type=sa.String(50))
    op.add_column('dominios', sa.Column('slug', sa.String(100), nullable=True))
    op.create_unique_constraint('uq_dominios_slug', 'dominios', ['slug'])

    # 2. Agregar columna protocolo con índice en tecnicas
    op.add_column('tecnicas', sa.Column('protocolo', sa.String(50), nullable=True))
    op.create_index('ix_tecnicas_protocolo', 'tecnicas', ['protocolo'])

    # 3. Actualizar registro existente de DNS al nuevo dominio oficial
    op.execute(
        "UPDATE dominios SET nombre = 'Network Infrastructure & Protocols', slug = 'network-infrastructure-protocols' WHERE nombre ILIKE 'DNS';"
    )


def downgrade() -> None:
    op.execute(
        "UPDATE dominios SET nombre = 'DNS', slug = 'dns' WHERE nombre ILIKE 'Network Infrastructure & Protocols';"
    )
    op.drop_index('ix_tecnicas_protocolo', table_name='tecnicas')
    op.drop_column('tecnicas', 'protocolo')
    op.drop_constraint('uq_dominios_slug', 'dominios', type_='unique')
    op.drop_column('dominios', 'slug')
    op.alter_column('dominios', 'nombre', type_=sa.String(50), existing_type=sa.String(100))
