export const dynamic = "force-dynamic";
export const maxDuration = 60; // Límite en Vercel Hobby (60s)

import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";
import CoberturaCards, { CoberturaResumen } from "../components/CoberturaCards";
import GraficoReglasPorTecnica, { TecnicaCoberturaItem } from "../components/GraficoReglasPorTecnica";
import SeccionTecnicas, { Tecnica } from "../dns/SeccionTecnicas";

interface CoberturaResponse {
  dominio_id: number;
  dominio_nombre: string;
  dominio_slug: string;
  resumen: CoberturaResumen;
  tecnicas: TecnicaCoberturaItem[];
}

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

async function fetchWithTimeout(url: string, timeoutMs = 45000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new DOMException("Timeout de conexión con el backend", "TimeoutError"));
  }, timeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    return res;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function getTecnicas(): Promise<Tecnica[]> {
  const res = await fetchWithTimeout(`${API_BASE}/dominios/endpoint-host-security/tecnicas`);
  if (!res.ok) {
    throw new Error(`Error al obtener técnicas de Endpoint (${res.status})`);
  }
  return await res.json();
}

async function getCobertura(): Promise<CoberturaResponse> {
  const res = await fetchWithTimeout(`${API_BASE}/dominios/endpoint-host-security/cobertura`);
  if (!res.ok) {
    throw new Error(`Error al obtener cobertura de Endpoint (${res.status})`);
  }
  return await res.json();
}

export default async function EndpointDashboardPage() {
  const [tecnicasRes, coberturaRes] = await Promise.allSettled([
    getTecnicas(),
    getCobertura(),
  ]);

  if (tecnicasRes.status === "rejected") {
    throw tecnicasRes.reason;
  }

  const tecnicas = tecnicasRes.value;

  const cobertura: CoberturaResponse =
    coberturaRes.status === "fulfilled"
      ? coberturaRes.value
      : {
          dominio_id: 20,
          dominio_nombre: "Endpoint & Host Security",
          dominio_slug: "endpoint-host-security",
          resumen: {
            total_tecnicas: tecnicas.length,
            tecnicas_con_controles: 0,
            tecnicas_sin_controles: tecnicas.length,
            porcentaje_con_controles: 0,
            total_reglas_unicas: 0,
          },
          tecnicas: [],
        };

  return (
    <main className="min-h-screen bg-umbra-bg text-umbra-ink p-8 md:p-16">
      <div className="max-w-6xl mx-auto">
        {/* Navegación superior */}
        <div className="flex items-center justify-between gap-4 mb-8">
          <Link
            href="/dominios"
            className="inline-flex items-center gap-2 text-sm text-umbra-ink-dim hover:text-umbra-ink transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al Catálogo
          </Link>
          <Link
            href="/repertorio"
            className="inline-flex items-center gap-1.5 text-xs text-umbra-cyan hover:underline transition-colors font-medium"
          >
            Ver Repertorio de Reglas →
          </Link>
        </div>

        {/* Encabezado del Dominio */}
        <header className="mb-10 pb-8 border-b border-umbra-line">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <div className="p-2 bg-umbra-cyan/10 text-umbra-cyan border border-umbra-cyan/30 rounded-lg">
              <Shield className="w-5 h-5" />
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-umbra-ink">
              Dominio: Endpoint & Host Security
            </h1>
            <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-950 text-emerald-400 border border-emerald-800/60 rounded-full">
              En Producción
            </span>
          </div>
          <p className="text-umbra-ink-dim max-w-3xl text-sm leading-relaxed">
            Superficie de ejecución, persistencia, elevación de privilegios y evasión de defensas en sistemas operativos (Windows, Linux, macOS). Correlación analítica entre técnicas MITRE ATT&CK, marcos normativos NIST SP 800-53 y reglas de detección comunitaria SigmaHQ.
          </p>
        </header>

        {/* 1. Componente de Cobertura: 3 tarjetas KPI destacadas */}
        <CoberturaCards resumen={cobertura.resumen} />

        {/* 2. Componente de Analítica: Reglas de detección por técnica (reemplazo analítico de CVEs) */}
        <GraficoReglasPorTecnica
          tecnicas={cobertura.tecnicas}
          dominioNombre="Endpoint & Host Security"
        />

        {/* 3. Matriz interactiva de Técnicas ATT&CK + Controles NIST + Reglas Sigma */}
        <SeccionTecnicas
          tecnicas={tecnicas}
          dominioCodigo="ENDPOINT"
          dominioNombre="Endpoint & Host Security"
        />
      </div>
    </main>
  );
}
