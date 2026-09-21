"""add_unique_constraint_to_url_fuente

Revision ID: 5846cd6bab33
Revises: 241417b31d02
Create Date: 2026-09-21 14:01:02.691584

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '5846cd6bab33'
down_revision: Union[str, None] = '241417b31d02'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_reglas_deteccion_url_fuente",
        "reglas_deteccion",
        ["url_fuente"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_reglas_deteccion_url_fuente",
        "reglas_deteccion",
        type_="unique",
    )
