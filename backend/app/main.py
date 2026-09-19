
import os
import logging
import traceback
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.middleware import SlowAPIMiddleware
from slowapi.errors import RateLimitExceeded
from app.routers import tecnicas, dominios

load_dotenv()

ENVIRONMENT = os.getenv("ENVIRONMENT", "development").lower()
is_production = ENVIRONMENT == "production"

logger = logging.getLogger("app")

def get_real_client_ip(request: Request) -> str:
    """
    Obtiene la IP real del cliente evitando la falsificación (spoofing) de encabezados.
    En plataformas como Render, el proxy inverso añade la IP pública real al final de X-Forwarded-For.
    Tomar el último elemento de la lista garantiza evaluar la IP legítima añadida por el proxy
    y no una IP falsa inyectada al inicio por el cliente para evadir el rate limit.
    En desarrollo local o conexiones directas, recurre a request.client.host.
    """
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        parts = [p.strip() for p in forwarded_for.split(",") if p.strip()]
        if parts:
            return parts[-1]
    if request.client and request.client.host:
        return request.client.host
    return "127.0.0.1"

# 1. Rate Limiting con SlowAPI (100 peticiones/minuto y ráfaga de 10 peticiones/segundo)
limiter = Limiter(
    key_func=get_real_client_ip,
    default_limits=["100/minute", "10/second"],
    headers_enabled=True,
)

app = FastAPI(
    title="Portal de Ciberseguridad Unificado API",
    description="API de catálogo de amenazas, mitigaciones normativas y reglas de detección.",
    version="0.1.0"
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# 2. Manejador de excepciones 500 diferenciado por ENVIRONMENT
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(
        f"Error no controlado en {request.method} {request.url.path}: {exc}",
        exc_info=True
    )
    if is_production:
        return JSONResponse(
            status_code=500,
            content={"detail": "Error interno del servidor. Por favor, intente más tarde."}
        )
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal Server Error (Modo Desarrollo)",
            "error_type": type(exc).__name__,
            "error_message": str(exc),
            "traceback": traceback.format_exc().splitlines(),
        }
    )

# Middlewares (se ejecutan en orden inverso de adición)
# SlowAPI Middleware para aplicar rate limiting globalmente
app.add_middleware(SlowAPIMiddleware)

# CORS
default_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

env_origins = os.getenv("ALLOWED_ORIGINS", "")
if env_origins.strip():
    custom_origins = [origin.strip() for origin in env_origins.split(",") if origin.strip()]
    allowed_origins = list(dict.fromkeys(default_origins + custom_origins))
else:
    allowed_origins = default_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dominios.router)
app.include_router(tecnicas.router)

@app.get("/")
@limiter.exempt
def health_check():
    return {"status": "ok", "message": "API de Ciberseguridad operativa"}
