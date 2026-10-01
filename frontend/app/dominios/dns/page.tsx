export const dynamic = "force-dynamic";
export const maxDuration = 60; // Límite máximo en Vercel Hobby (60 segundos)

import Link from "next/link";
import { ArrowLeft, Network } from "lucide-react";
import CoberturaCards, { CoberturaResumen } from "../components/CoberturaCards";
import GraficoReglasPorTecnica, { TecnicaCoberturaItem } from "../components/GraficoReglasPorTecnica";
import SeccionTecnicas, { Tecnica } from "./SeccionTecnicas";
import GraficoSeveridad from "./GraficoSeveridad";
import GraficoTendenciaCVEs, { TendenciaMes } from "./GraficoTendenciaCVEs";
import SeccionVulnerabilidades, { Vulnerabilidad } from "./SeccionVulnerabilidades";

interface CoberturaResponse {
  dominio_id: number;
  dominio_nombre: string;
  dominio_slug: string;
  resumen: CoberturaResumen;
  tecnicas: TecnicaCoberturaItem[];
}

interface VulnerabilidadesResponse {
  total: number;
  limit: number;
  offset: number;
  items: Vulnerabilidad[];
}

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

/**
 * Helper de fetch con timeout explícito (45s) y demora configurable de depuración.
 * La demora compite directamente con el AbortSignal para reproducir de forma realista
 * el mismo TimeoutError que causaría un backend no responsivo.
 */
async function fetchWithTimeoutAndDebugDelay(url: string, timeoutMs = 45000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new DOMException("Timeout de conexión con el backend", "TimeoutError"));
  }, timeoutMs);
  const signal = controller.signal;

  const debugDelay = parseInt(process.env.DEBUG_FETCH_DELAY_MS || "0", 10);
  if (debugDelay > 0) {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, debugDelay);
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          reject(signal.reason);
        },
        { once: true }
      );
    });
  }

  try {
    const res = await fetch(url, { signal, cache: "no-store" });
    return res;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function getTecnicas(): Promise<Tecnica[]> {
  const res = await fetchWithTimeoutAndDebugDelay(`${API_BASE}/dominios/DNS/tecnicas`);
  if (!res.ok) {
    throw new Error(`Error en el servidor al obtener técnicas (${res.status})`);
  }
  return await res.json();
}

async function getCobertura(): Promise<CoberturaResponse> {
  const res = await fetchWithTimeoutAndDebugDelay(`${API_BASE}/dominios/DNS/cobertura`);
  if (!res.ok) {
    throw new Error(`Error en el servidor al obtener cobertura (${res.status})`);
  }
  return await res.json();
}

async function getVulnerabilidades(): Promise<VulnerabilidadesResponse> {
  const res = await fetchWithTimeoutAndDebugDelay(`${API_BASE}/dominios/DNS/vulnerabilidades`);
  if (!res.ok) {
    throw new Error(`Error en el servidor al obtener vulnerabilidades (${res.status})`);
  }
  return await res.json();
}

async function getTendenciaInicial(): Promise<TendenciaMes[]> {
  const res = await fetchWithTimeoutAndDebugDelay(`${API_BASE}/dominios/DNS/vulnerabilidades/tendencia?rango=6m`);
  if (!res.ok) {
    throw new Error(`Error en el servidor al obtener tendencia (${res.status})`);
  }
  return await res.json();
}

export default async function DnsDashboardPage() {
  // Carga concurrente con Promise.allSettled
  const [tecnicasRes, coberturaRes, cvesRes, tendenciaRes] = await Promise.allSettled([
    getTecnicas(),
    getCobertura(),
    getVulnerabilidades(),
    getTendenciaInicial(),
  ]);

  // 1. Fetch principal (crítico): si falló, relanzamos explícitamente para que error.tsx capture la excepción
  if (tecnicasRes.status === "rejected") {
    throw tecnicasRes.reason;
  }

  const tecnicas = tecnicasRes.value;

  // 2. Fetches secundarios (resilientes): si fallan, se proporcionan valores por defecto y no se tumba la página completa
  const cobertura: CoberturaResponse =
    coberturaRes.status === "fulfilled"
      ? coberturaRes.value
      : {
          dominio_id: 1,
          dominio_nombre: "Network Infrastructure & Protocols",
          dominio_slug: "network-infrastructure-protocols",
          resumen: {
            total_tecnicas: tecnicas.length,
            tecnicas_con_controles: 0,
            tecnicas_sin_controles: tecnicas.length,
            porcentaje_con_controles: 0,
            total_reglas_unicas: 0,
          },
          tecnicas: [],
        };

  const cvesData: VulnerabilidadesResponse =
    cvesRes.status === "fulfilled"
      ? cvesRes.value
      : { total: 0, limit: 40, offset: 0, items: [] };

  const tendenciaInicial: TendenciaMes[] =
    tendenciaRes.status === "fulfilled"
      ? tendenciaRes.value
      : [];

  const cves = cvesData.items;
  const totalCves = cvesData.total;

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

        {/* 1. Encabezado del Dominio */}
        <header className="mb-10 pb-8 border-b border-umbra-line">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <div className="p-2 bg-umbra-cyan/10 text-umbra-cyan border border-umbra-cyan/30 rounded-lg">
              <Network className="w-5 h-5" />
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-umbra-ink">
              Dominio: Network Infrastructure & Protocols
            </h1>
            <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-950 text-emerald-400 border border-emerald-800/60 rounded-full">
              En Producción
            </span>
          </div>
          <p className="text-umbra-ink-dim max-w-3xl text-sm leading-relaxed">
            Correlación analítica entre técnicas de ataque MITRE ATT&CK, marcos de mitigación NIST SP 800-53,
            reglas de detección SigmaHQ y vulnerabilidades para DNS, SMB, FTP, Servicios L2/L3 y Tráfico de Red.
          </p>
        </header>

        {/* 2. Cobertura de Seguridad: 4 tarjetas KPI integradas */}
        <CoberturaCards resumen={cobertura.resumen} totalCves={totalCves} />

        {/* 3. Analítica de Detección: Reglas SigmaHQ por Técnica ATT&CK */}
        <GraficoReglasPorTecnica
          tecnicas={cobertura.tecnicas}
          dominioNombre="Network Infrastructure & Protocols"
        />

        {/* 4. Matriz interactiva MITRE ATT&CK + NIST SP 800-53 + SigmaHQ */}
        <SeccionTecnicas
          tecnicas={tecnicas}
          dominioCodigo="NET-INFRA"
          dominioNombre="Network Infrastructure & Protocols"
        />

        {/* 5. Analítica de Vulnerabilidades: Severidad CVSS y Tendencia Temporal */}
        <GraficoSeveridad cves={cves} />

        <GraficoTendenciaCVEs
          apiBase={API_BASE}
          initialData={tendenciaInicial}
          dominioSlug="DNS"
          titulo="CVEs de Red Divulgados por Mes"
          descripcionFuente="Frecuencia de vulnerabilidades de infraestructura y protocolos de red (DNS, SMB, FTP, servicios L2/L3) publicadas formalmente en NVD según su fecha oficial de divulgación."
        />

        {/* 6. Tabla de Vulnerabilidades NVD Paginada y Expandible */}
        <SeccionVulnerabilidades
          initialCves={cves}
          total={totalCves}
          apiBase={API_BASE}
          dominioSlug="DNS"
          titulo="Vulnerabilidades de Red Recientes (NVD)"
        />
      </div>
    </main>
  );
}
