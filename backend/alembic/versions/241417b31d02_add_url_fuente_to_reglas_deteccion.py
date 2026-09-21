"""add_url_fuente_to_reglas_deteccion

Revision ID: 241417b31d02
Revises: 9b9490776f20
Create Date: 2026-09-21 13:45:42.814668

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '241417b31d02'
down_revision: Union[str, None] = '9b9490776f20'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("reglas_deteccion", sa.Column("url_fuente", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("reglas_deteccion", "url_fuente")
