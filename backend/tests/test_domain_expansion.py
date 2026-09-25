import httpx
import pytest

from app.main import app


@pytest.mark.anyio
async def test_dominio_nombre_oficial_tecnicas():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/dominios/Network Infrastructure & Protocols/tecnicas")
        assert response.status_code == 200
        tecnicas = response.json()
        assert isinstance(tecnicas, list)
        assert len(tecnicas) >= 30

        # Verificar que cada técnica contiene el metadato de protocolo
        protocolos_vistos = set()
        for t in tecnicas:
            assert "protocolo" in t
            assert t["protocolo"] in ("DNS", "SMB", "FTP", "DHCP", "ARP", "GENERAL")
            protocolos_vistos.add(t["protocolo"])

        # Verificar que todos los grupos clave están representados
        assert "DNS" in protocolos_vistos
        assert "SMB" in protocolos_vistos
        assert "FTP" in protocolos_vistos
        assert "GENERAL" in protocolos_vistos


@pytest.mark.anyio
async def test_dominio_slug_resolucion():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/dominios/network-infrastructure-protocols/tecnicas")
        assert response.status_code == 200
        tecnicas = response.json()
        assert len(tecnicas) >= 30


@pytest.mark.anyio
async def test_dominio_alias_retrocompatibilidad_dns():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/dominios/DNS/tecnicas")
        assert response.status_code == 200
        tecnicas = response.json()
        assert len(tecnicas) >= 30


@pytest.mark.anyio
async def test_dominio_vulnerabilidades_retrocompatibilidad():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        resp_vulns = await client.get("/dominios/DNS/vulnerabilidades")
        assert resp_vulns.status_code == 200
        data = resp_vulns.json()
        assert "items" in data
        assert "total" in data

        resp_tend = await client.get("/dominios/DNS/vulnerabilidades/tendencia?rango=6m")
        assert resp_tend.status_code == 200
        assert isinstance(resp_tend.json(), list)
