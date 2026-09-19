from datetime import date

from app.routers.dominios import calcular_meses_esperados


def test_calculo_meses_6m_normal():
    # Desde junio 2026, 6 meses esperados
    ref = date(2026, 6, 20)
    meses = calcular_meses_esperados(ref, 6)
    assert len(meses) == 6
    assert meses == ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"]

def test_calculo_meses_rollover_fin_de_ano():
    # Caso crítico: Desde enero 2026 (mes 1), retroceder 6 meses debe cruzar correctamente a 2025
    ref = date(2026, 1, 15)
    meses = calcular_meses_esperados(ref, 6)
    assert len(meses) == 6
    assert meses == ["2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01"]

def test_calculo_meses_ano_completo_1y():
    # Rango 1y (12 meses) desde marzo 2026
    ref = date(2026, 3, 1)
    meses = calcular_meses_esperados(ref, 12)
    assert len(meses) == 12
    assert meses[0] == "2025-04"
    assert meses[-1] == "2026-03"

def test_calculo_meses_ano_bisiesto():
    # Febrero en año bisiesto (2024)
    ref = date(2024, 3, 1)
    meses = calcular_meses_esperados(ref, 3)
    assert meses == ["2024-01", "2024-02", "2024-03"]
