export const dynamic = "force-dynamic";
export const maxDuration = 60; // Límite máximo en Vercel Hobby (60 segundos)

import Link from "next/link";
import { ArrowLeft, ShieldAlert, AlertTriangle, ShieldCheck, Activity } from "lucide-react";
import GraficoSeveridad from "./GraficoSeveridad";
import GraficoTendenciaCVEs, { TendenciaMes } from "./GraficoTendenciaCVEs";
import SeccionTecnicas, { Tecnica } from "./SeccionTecnicas";
import SeccionVulnerabilidades, { Vulnerabilidad } from "./SeccionVulnerabilidades";

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
  const [tecnicasRes, cvesRes, tendenciaRes] = await Promise.allSettled([
    getTecnicas(),
    getVulnerabilidades(),
    getTendenciaInicial(),
  ]);

  // 1. Fetch principal (crítico): si falló, relanzamos explícitamente para que error.tsx capture la excepción
  if (tecnicasRes.status === "rejected") {
    throw tecnicasRes.reason;
  }

  const tecnicas = tecnicasRes.value;

  // 2. Fetches secundarios (resilientes): si fallan, se proporcionan valores por defecto y no se tumba la página completa
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

  // Contar controles y reglas únicos
  const totalControles = new Set(tecnicas.flatMap((t) => t.controles.map((c) => c.codigo))).size;
  const totalReglas = new Set(tecnicas.flatMap((t) => t.reglas.map((r) => r.id))).size;

  // Promedio CVSS
  const scoresValidos = cves
    .filter((c) => c.cvss_score !== null)
    .map((c) => c.cvss_score as number);
  const promedioCvss =
    scoresValidos.length > 0
      ? (scoresValidos.reduce((a, b) => a + b, 0) / scoresValidos.length).toFixed(1)
      : "N/A";

  return (
    <main className="min-h-screen bg-umbra-bg text-umbra-ink p-8 md:p-16">
      <div className="max-w-6xl mx-auto">
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

        {/* Encabezado */}
        <header className="mb-10 pb-8 border-b border-umbra-line">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-umbra-ink">
              Dominio: Network Infrastructure & Protocols
            </h1>
            <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-950 text-emerald-400 border border-emerald-800/60 rounded-full">
              En Producción
            </span>
          </div>
          <p className="text-umbra-ink-dim max-w-3xl">
            Correlación analítica entre técnicas de ataque MITRE ATT&CK, marcos de mitigación NIST SP 800-53,
            reglas de detección SigmaHQ y vulnerabilidades para DNS, SMB, FTP, Servicios L2/L3 y Tráfico de Red.
          </p>
        </header>

        {/* Contadores dinámicos */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <div className="bg-umbra-surface border border-umbra-line p-5 rounded-xl">
            <div className="flex items-center justify-between text-umbra-ink-dim mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Técnicas ATT&CK</span>
              <Activity className="w-4 h-4 text-umbra-cyan" />
            </div>
            <p className="text-2xl font-bold text-umbra-ink">{tecnicas.length}</p>
          </div>

          <div className="bg-umbra-surface border border-umbra-line p-5 rounded-xl">
            <div className="flex items-center justify-between text-umbra-ink-dim mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Controles NIST</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-bold text-umbra-ink">{totalControles}</p>
          </div>

          <div className="bg-umbra-surface border border-umbra-line p-5 rounded-xl">
            <div className="flex items-center justify-between text-umbra-ink-dim mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Reglas Sigma</span>
              <ShieldAlert className="w-4 h-4 text-umbra-cyan" />
            </div>
            <p className="text-2xl font-bold text-umbra-ink">{totalReglas}</p>
          </div>

          <div className="bg-umbra-surface border border-umbra-line p-5 rounded-xl">
            <div className="flex items-center justify-between text-umbra-ink-dim mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">CVSS Promedio</span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-2xl font-bold text-umbra-ink">{promedioCvss}</p>
          </div>
        </div>

        {/* Gráfico de distribución CVSS */}
        <GraficoSeveridad cves={cves} />

        {/* Gráfico de tendencia temporal de CVEs divulgados */}
        <GraficoTendenciaCVEs apiBase={API_BASE} initialData={tendenciaInicial} />

        {/* Matriz MITRE ATT&CK + NIST + Sigma */}
        <SeccionTecnicas
          tecnicas={tecnicas}
          dominioCodigo="NET-INFRA"
          dominioNombre="Network Infrastructure & Protocols"
        />

        {/* Tabla de vulnerabilidades recientes con paginación y filas expandibles */}
        <SeccionVulnerabilidades
          initialCves={cves}
          total={totalCves}
          apiBase={API_BASE}
        />
      </div>
    </main>
  );
}
