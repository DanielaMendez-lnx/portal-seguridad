

import Link from "next/link";
import { ArrowLeft, ShieldAlert, AlertTriangle, ShieldCheck, Activity } from "lucide-react";
import GraficoSeveridad from "./GraficoSeveridad";
import SeccionTecnicas, { Tecnica } from "./SeccionTecnicas";

interface Vulnerabilidad {
  id: string;
  descripcion: string;
  fecha_publicacion: string;
  cvss_score: number | null;
  cvss_severity: string | null;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

async function getVulnerabilidades(): Promise<Vulnerabilidad[]> {
  try {
    const res = await fetch(`${API_BASE}/dominios/DNS/vulnerabilidades`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    return await res.json();
  } catch (error) {
    console.error("[Fetch Error] Vulnerabilidades:", error);
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
  const [cves, tecnicas] = await Promise.all([
    getVulnerabilidades(),
    getTecnicas(),
  ]);

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

  const getSeverityBadge = (severity: string | null) => {
    switch (severity?.toUpperCase()) {
      case "CRITICAL":
        return "bg-rose-950/80 text-rose-400 border-rose-800/60";
      case "HIGH":
        return "bg-amber-950/80 text-amber-400 border-amber-800/60";
      case "MEDIUM":
        return "bg-yellow-950/80 text-yellow-400 border-yellow-800/60";
      case "LOW":
        return "bg-blue-950/80 text-blue-400 border-blue-800/60";
      default:
        return "bg-slate-800 text-slate-400 border-slate-700";
    }
  };

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

        {/* Matriz MITRE ATT&CK + NIST + Sigma */}
        <SeccionTecnicas tecnicas={tecnicas} />

        {/* Tabla de vulnerabilidades recientes */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-lg font-bold text-white">Vulnerabilidades Recientes (NVD)</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Ingesta directa de la API de NIST con validación de severidad y contrato CVSS.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400 bg-slate-950 px-3 py-1 rounded-lg border border-slate-800">
              {cves.length} registros cargados
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="text-xs font-semibold uppercase text-slate-400 border-b border-slate-800 bg-slate-950/40">
                <tr>
                  <th className="py-3 px-4">Identificador</th>
                  <th className="py-3 px-4">Severidad</th>
                  <th className="py-3 px-4">Puntaje</th>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Descripción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {cves.map((cve) => (
                  <tr key={cve.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-indigo-300 whitespace-nowrap">
                      {cve.id}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-md border font-semibold ${getSeverityBadge(cve.cvss_severity)}`}>
                        {cve.cvss_severity || "UNKNOWN"}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-medium">
                      {cve.cvss_score !== null ? cve.cvss_score.toFixed(1) : "N/A"}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-400 whitespace-nowrap">
                      {cve.fecha_publicacion}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-400 max-w-md truncate" title={cve.descripcion}>
                      {cve.descripcion}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

