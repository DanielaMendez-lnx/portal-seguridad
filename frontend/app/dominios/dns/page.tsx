

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

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

async function getVulnerabilidades(): Promise<VulnerabilidadesResponse> {
  try {
    const res = await fetch(`${API_BASE}/dominios/DNS/vulnerabilidades`, {
      cache: "no-store",
    });
    if (!res.ok) return { total: 0, limit: 40, offset: 0, items: [] };
    return await res.json();
  } catch (error) {
    console.error("[Fetch Error] Vulnerabilidades:", error);
    return { total: 0, limit: 40, offset: 0, items: [] };
  }
}

async function getTendenciaInicial(): Promise<TendenciaMes[]> {
  try {
    const res = await fetch(`${API_BASE}/dominios/DNS/vulnerabilidades/tendencia?rango=6m`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    return await res.json();
  } catch (error) {
    console.error("[Fetch Error] Tendencia:", error);
    return [];
  }
}

async function getTecnicas(): Promise<Tecnica[]> {
  try {
    const res = await fetch(`${API_BASE}/dominios/DNS/tecnicas`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    return await res.json();
  } catch (error) {
    console.error("[Fetch Error] Técnicas:", error);
    return [];
  }
}

export default async function DnsDashboardPage() {
  // Carga concurrente
  const [cvesData, tecnicas, tendenciaInicial] = await Promise.all([
    getVulnerabilidades(),
    getTecnicas(),
    getTendenciaInicial(),
  ]);

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
    <main className="min-h-screen bg-slate-950 text-slate-100 p-8 md:p-16">
      <div className="max-w-6xl mx-auto">
        <Link
          href="/dominios"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al Catálogo
        </Link>

        {/* Encabezado */}
        <header className="mb-10 pb-8 border-b border-slate-800">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
              Dominio: Domain Name System (DNS)
            </h1>
            <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-950 text-emerald-400 border border-emerald-800/60 rounded-full">
              En Producción
            </span>
          </div>
          <p className="text-slate-400 max-w-3xl">
            Correlación analítica entre técnicas de ataque MITRE ATT&CK, marcos de mitigación NIST,
            reglas de detección y vulnerabilidades NVD.
          </p>
        </header>

        {/* Contadores dinámicos */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Técnicas ATT&CK</span>
              <Activity className="w-4 h-4 text-indigo-400" />
            </div>
            <p className="text-2xl font-bold text-white">{tecnicas.length}</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Controles NIST</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-bold text-white">{totalControles}</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Reglas Sigma</span>
              <ShieldAlert className="w-4 h-4 text-cyan-400" />
            </div>
            <p className="text-2xl font-bold text-white">{totalReglas}</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">CVSS Promedio</span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-2xl font-bold text-white">{promedioCvss}</p>
          </div>
        </div>

        {/* Gráfico de distribución CVSS */}
        <GraficoSeveridad cves={cves} />

        {/* Gráfico de tendencia temporal de CVEs divulgados */}
        <GraficoTendenciaCVEs apiBase={API_BASE} initialData={tendenciaInicial} />

        {/* Matriz MITRE ATT&CK + NIST + Sigma */}
        <SeccionTecnicas tecnicas={tecnicas} />

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

