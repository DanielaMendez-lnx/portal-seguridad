from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import tecnicas

app = FastAPI(
    title="Portal de Ciberseguridad Unificado API",
    description="API de catálogo de amenazas, mitigaciones normativas y reglas de detección.",
    version="0.1.0"
)

# Configuración básica de CORS para que el frontend pueda consumir la API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tecnicas.router)

@app.get("/")
def health_check():
    return {"status": "ok", "message": "API de Ciberseguridad operativa"}