import httpx
import pytest

from app.main import app

# ==============================================================================
# 1. PRUEBAS DE INVARIANTES ESTRUCTURALES (Corren en cada push / CI)
#    No dependen de números específicos de reglas que cambian con updates de Sigma.
# ==============================================================================

@pytest.mark.anyio
async def test_cobertura_endpoint_invariantes_estructurales():
    """
    Verifica los invariantes estructurales de Endpoint & Host Security:
    - Estado HTTP 200 y metadatos del dominio.
    - Catálogo fijo de 25 técnicas operativas.
    - Invariante de suma: tecnicas_con_controles + tecnicas_sin_controles == total_tecnicas.
    - Invariante de porcentaje: porcentaje_con_controles consistente con la división.
    - Ordenamiento estricto: la lista de técnicas viene ordenada de mayor a menor por total_reglas.
    - Existencia de reglas únicas (> 0) y no negatividad en cada técnica.
    - Consistencia de las 4 técnicas intrínsecamente sin mitigación directa en CTID.
    """
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/dominios/endpoint-host-security/cobertura")
        assert response.status_code == 200
        data = response.json()

        assert data["dominio_nombre"] == "Endpoint & Host Security"
        resumen = data["resumen"]

        # Invariante 1: Total de técnicas fijado por el catálogo de siembra
        assert resumen["total_tecnicas"] == 25
        assert len(data["tecnicas"]) == 25

        # Invariante 2: Suma de técnicas con y sin controles es exhaustiva
        con_ctrl = resumen["tecnicas_con_controles"]
        sin_ctrl = resumen["tecnicas_sin_controles"]
        assert con_ctrl + sin_ctrl == resumen["total_tecnicas"]

        # Invariante 3: Porcentaje consistente con la fórmula de negocio
        esperado_pct = round((con_ctrl / resumen["total_tecnicas"]) * 100, 1)
        assert resumen["porcentaje_con_controles"] == esperado_pct

        # Invariante 4: Orden descendente por total_reglas
        totales = [t["total_reglas"] for t in data["tecnicas"]]
        assert totales == sorted(totales, reverse=True)
        assert all(t >= 0 for t in totales)

        # Invariante 5: Integridad de reglas vinculadas
        assert resumen["total_reglas_unicas"] > 0

        # Invariante 6: Las 4 técnicas de solo lectura/usuario sin mitigación en CTID
        tecnicas_dict = {t["tecnica_id"]: t for t in data["tecnicas"]}
        tecnicas_sin_mitigacion = ["T1547.001", "T1033", "T1082", "T1083"]
        for tid in tecnicas_sin_mitigacion:
            assert tid in tecnicas_dict
            assert tecnicas_dict[tid]["tiene_controles"] is False


@pytest.mark.anyio
async def test_cobertura_network_invariantes_estructurales():
    """
    Verifica los invariantes estructurales de Network Infrastructure & Protocols:
    - Estado HTTP 200 y metadatos del dominio.
    - Catálogo fijo de 35 técnicas operativas.
    - Invariante de suma y coherencia porcentual.
    - Orden descendente por total_reglas.
    - Existencia de reglas únicas (> 0).
    """
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/dominios/network-infrastructure-protocols/cobertura")
        assert response.status_code == 200
        data = response.json()

        assert data["dominio_nombre"] == "Network Infrastructure & Protocols"
        resumen = data["resumen"]

        assert resumen["total_tecnicas"] == 35
        assert len(data["tecnicas"]) == 35

        con_ctrl = resumen["tecnicas_con_controles"]
        sin_ctrl = resumen["tecnicas_sin_controles"]
        assert con_ctrl + sin_ctrl == resumen["total_tecnicas"]

        esperado_pct = round((con_ctrl / resumen["total_tecnicas"]) * 100, 1)
        assert resumen["porcentaje_con_controles"] == esperado_pct

        totales = [t["total_reglas"] for t in data["tecnicas"]]
        assert totales == sorted(totales, reverse=True)
        assert resumen["total_reglas_unicas"] > 0


@pytest.mark.anyio
async def test_cobertura_dominio_inexistente():
    """
    Verifica que la consulta a un dominio inválido devuelva HTTP 404.
    """
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/dominios/dominio-que-no-existe-xyz/cobertura")
        assert response.status_code == 404
        assert response.json()["detail"] == "Dominio no encontrado"


# ==============================================================================
# 2. PRUEBA DE SNAPSHOT DE DATOS EXTERNOS (Marcada explícitamente)
#    Verifica la foto exacta de datos ingeridos inicialmente. Puede omitirse
#    en CI con `pytest -m "not snapshot"` si los feeds externos se actualizan.
# ==============================================================================

@pytest.mark.snapshot
@pytest.mark.anyio
async def test_cobertura_endpoint_snapshot_siembra_inicial():
    """
    SNAPSHOT HISTÓRICO DE REFERENCIA (Siembra Septiembre 2026).
    Valida la calibración inicial de reglas SigmaHQ y controles CTID:
    - 968 reglas de detección únicas para Endpoint.
    - 21 técnicas con mapeo directo y 4 sin controles en CTID.
    - T1059.001 (PowerShell) lidera el volumen con 201 reglas.
    """
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/dominios/endpoint-host-security/cobertura")
        assert response.status_code == 200
        data = response.json()
        resumen = data["resumen"]

        # Valores del snapshot inicial
        assert resumen["total_reglas_unicas"] == 968
        assert resumen["tecnicas_con_controles"] == 21
        assert resumen["tecnicas_sin_controles"] == 4
        assert resumen["porcentaje_con_controles"] == 84.0

        # Técnica líder en el snapshot inicial
        top_tecnica = data["tecnicas"][0]
        assert top_tecnica["tecnica_id"] == "T1059.001"
        assert top_tecnica["total_reglas"] == 201
        assert top_tecnica["tiene_controles"] is True
