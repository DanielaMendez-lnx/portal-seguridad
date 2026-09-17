
import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import tecnicas, dominios

load_dotenv()

app = FastAPI(
    title="Portal de Ciberseguridad Unificado API",
    description="API de catálogo de amenazas, mitigaciones normativas y reglas de detección.",
    version="0.1.0"
)

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
def health_check():
    return {"status": "ok", "message": "API de Ciberseguridad operativa"}