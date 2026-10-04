import httpx
import pytest

from app.main import app


@pytest.mark.anyio
async def test_traducciones_regla_existente_con_traducciones():
    """Verifica que una regla con traducciones (ID 1223) devuelva 200 y la estructura completa de formatos."""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/reglas/1223/traducciones")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 3

        formatos_presentes = {t["formato"] for t in data}
        assert "splunk" in formatos_presentes
        assert "elastic" in formatos_presentes
        assert "kql_sentinel" in formatos_presentes

        # Invariantes estructurales por traducción
        for t in data:
            assert "formato" in t and isinstance(t["formato"], str) and len(t["formato"]) > 0
            assert "query" in t and isinstance(t["query"], str) and len(t["query"]) > 0
            assert "flavor_label" in t
            assert "target_table" in t


@pytest.mark.anyio
async def test_traducciones_regla_existente_sin_traducciones():
    """Verifica que una regla existente sin traducciones (ID 1170) devuelva 200 con array vacío []."""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/reglas/1170/traducciones")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 0


@pytest.mark.anyio
async def test_traducciones_regla_inexistente():
    """Verifica que solicitar traducciones para un regla_id inexistente retorne 404."""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/reglas/999999/traducciones")
        assert response.status_code == 404
        assert response.json()["detail"] == "Regla no encontrada"
