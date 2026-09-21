import httpx
import pytest

from app.main import app


@pytest.mark.anyio
async def test_validacion_formato_tecnica_invalida():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/tecnicas/ID_TOTALMENTE_INVALIDO")
        assert response.status_code == 422
        data = response.json()
        assert "detail" in data

@pytest.mark.anyio
async def test_validacion_formato_tecnica_valida_pero_inexistente():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/tecnicas/T9999")
        assert response.status_code == 404
        assert response.json()["detail"] == "Técnica no encontrada"


@pytest.mark.anyio
async def test_validacion_formato_tecnica_valida_existente():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/tecnicas/T1071.004")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == "T1071.004"
        assert "nombre" in data
        assert "tactica" in data
        assert "controles" in data
        assert "reglas" in data
        assert isinstance(data["controles"], list)
        assert isinstance(data["reglas"], list)
        assert len(data["reglas"]) > 0
        for r in data["reglas"]:
            assert "url_fuente" in r
            assert "id" in r
            assert "nombre" in r
