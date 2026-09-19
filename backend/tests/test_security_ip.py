from starlette.requests import Request

from app.main import get_real_client_ip


def crear_request_simulado(headers_dict=None, client_host="127.0.0.1"):
    headers = []
    if headers_dict:
        for k, v in headers_dict.items():
            headers.append((k.lower().encode("latin1"), v.encode("latin1")))

    scope = {
        "type": "http",
        "headers": headers,
        "client": (client_host, 12345) if client_host else None
    }
    return Request(scope)

def test_ip_spoofed_render_toma_ultima_ip():
    # Un atacante inyecta 1.1.1.1 y 10.0.0.1, Render agrega 203.0.113.50 al final
    req = crear_request_simulado(
        headers_dict={"x-forwarded-for": "1.1.1.1, 10.0.0.1, 203.0.113.50"},
        client_host="10.0.0.1"
    )
    ip = get_real_client_ip(req)
    assert ip == "203.0.113.50"

def test_ip_unica_en_header():
    # Petición legítima directa a través del proxy
    req = crear_request_simulado(
        headers_dict={"X-Forwarded-For": "198.51.100.99"},
        client_host="10.0.0.1"
    )
    ip = get_real_client_ip(req)
    assert ip == "198.51.100.99"

def test_ip_con_espacios_y_mayusculas():
    # Formato sucio con espacios
    req = crear_request_simulado(
        headers_dict={"x-forwarded-for": "  1.2.3.4  ,   203.0.113.77  "}
    )
    ip = get_real_client_ip(req)
    assert ip == "203.0.113.77"

def test_ip_conexion_local_sin_header():
    # Desarrollo local sin proxy intermedio
    req = crear_request_simulado(headers_dict=None, client_host="192.168.1.50")
    ip = get_real_client_ip(req)
    assert ip == "192.168.1.50"

def test_ip_fallback_cuando_no_hay_cliente():
    # Scope sin información de cliente
    req = crear_request_simulado(headers_dict=None, client_host=None)
    ip = get_real_client_ip(req)
    assert ip == "127.0.0.1"
