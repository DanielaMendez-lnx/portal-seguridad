"use client";

import { useState, Fragment } from "react";
import { ChevronDown, ChevronUp, ExternalLink, Loader2 } from "lucide-react";

export interface Vulnerabilidad {
  id: string;
  descripcion: string;
  fecha_publicacion: string;
  cvss_score: number | null;
  cvss_severity: string | null;
}

interface Props {
  initialCves: Vulnerabilidad[];
  total: number;
  apiBase: string;
}

export default function SeccionVulnerabilidades({ initialCves, total, apiBase }: Props) {
  const [cves, setCves] = useState<Vulnerabilidad[]>(initialCves);
  const [totalCves, setTotalCves] = useState<number>(total);
  const [offset, setOffset] = useState<number>(initialCves.length);
  const [cargando, setCargando] = useState<boolean>(false);
  const [cveExpandido, setCveExpandido] = useState<string | null>(null);

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

  const toggleExpandir = (id: string) => {
    setCveExpandido((prev) => (prev === id ? null : id));
  };

  const hayMas = cves.length < totalCves;

  const cargarMas = async () => {
    if (cargando || !hayMas) return;
    setCargando(true);
    try {
      const res = await fetch(`${apiBase}/dominios/DNS/vulnerabilidades?limit=40&offset=${offset}`);
      if (!res.ok) {
        throw new Error(`Error en el servidor: ${res.status}`);
      }
      const data: { total: number; limit: number; offset: number; items: Vulnerabilidad[] } = await res.json();
      if (data.items && data.items.length > 0) {
        setCves((prev) => [...prev, ...data.items]);
        setOffset((prev) => prev + data.items.length);
        if (data.total !== undefined) {
          setTotalCves(data.total);
        }
      }
    } catch (error) {
      console.error("[Cargar Más Error]:", error);
    } finally {
      setCargando(false);
    }
  };

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-white">Vulnerabilidades Recientes (NVD)</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Ingesta directa de la API de NIST con validación de severidad y contrato CVSS.
          </p>
        </div>
        <span className="text-xs font-mono text-slate-400 bg-slate-950 px-3 py-1 rounded-lg border border-slate-800">
          {cves.length} de {totalCves} cargados
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
            {cves.map((cve) => {
              const expandido = cveExpandido === cve.id;
              return (
                <Fragment key={cve.id}>
                  {/* Fila Colapsada / Principal */}
                  <tr
                    role="button"
                    tabIndex={0}
                    aria-expanded={expandido}
                    onClick={() => toggleExpandir(cve.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleExpandir(cve.id);
                      }
                    }}
                    className={`cursor-pointer transition-colors focus:outline-none focus:bg-slate-800/80 ${
                      expandido ? "bg-slate-800/60" : "hover:bg-slate-800/40"
                    }`}
                  >
                    <td className="py-3 px-4 font-mono font-semibold text-indigo-300 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {expandido ? (
                          <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                        <span>{cve.id}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-md border font-semibold ${getSeverityBadge(
                          cve.cvss_severity
                        )}`}
                      >
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

                  {/* Fila Expandida con vista detallada */}
                  {expandido && (
                    <tr className="bg-slate-950/70 border-b border-slate-800/80">
                      <td colSpan={5} className="p-4 md:p-6">
                        <div className="space-y-4">
                          <div>
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                              Descripción Completa
                            </h4>
                            <p className="text-xs text-slate-300 leading-relaxed">
                              {cve.descripcion}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-800/60 text-xs">
                            <div className="flex flex-wrap items-center gap-6">
                              <div>
                                <span className="text-slate-500 mr-1.5">Severidad CVSS:</span>
                                <span
                                  className={`px-2 py-0.5 rounded-md border font-semibold ${getSeverityBadge(
                                    cve.cvss_severity
                                  )}`}
                                >
                                  {cve.cvss_severity || "UNKNOWN"}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-500 mr-1.5">Puntaje Base:</span>
                                <span className="font-mono font-bold text-white">
                                  {cve.cvss_score !== null ? cve.cvss_score.toFixed(1) : "N/A"}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-500 mr-1.5">Fecha Publicación:</span>
                                <span className="font-mono text-slate-300">
                                  {cve.fecha_publicacion}
                                </span>
                              </div>
                            </div>

                            <a
                              href={`https://nvd.nist.gov/vuln/detail/${cve.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 hover:underline transition-colors shrink-0"
                            >
                              <span>Ver ficha oficial en NIST NVD</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Botón Cargar Más */}
      <div className="mt-6 flex flex-col items-center justify-center">
        {hayMas ? (
          <button
            onClick={cargarMas}
            disabled={cargando}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer shadow-sm"
          >
            {cargando ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                <span>Cargando más registros...</span>
              </>
            ) : (
              <span>Cargar más ({cves.length} de {totalCves})</span>
            )}
          </button>
        ) : (
          totalCves > 0 && (
            <p className="text-xs text-slate-500 text-center py-2">
              Se han cargado todas las vulnerabilidades registradas ({totalCves} de {totalCves}).
            </p>
          )
        )}
      </div>
    </section>
  );
}
