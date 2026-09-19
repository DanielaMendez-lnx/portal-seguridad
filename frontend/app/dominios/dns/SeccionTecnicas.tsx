
"use client";

import { useState } from "react";
import { ShieldCheck, Terminal, Search, ChevronDown, ChevronUp } from "lucide-react";

export interface Control {
  codigo: string;
  nombre: string;
  marco?: string;
  tipo_confianza?: string;
  fuente_nombre?: string | null;
  fuente_url?: string | null;
}

export interface Regla {
  id: number;
  nombre: string;
  formato: string;
  log_source: string | null;
}

export interface Tecnica {
  id: string;
  nombre: string;
  tactica: string;
  descripcion: string | null;
  controles: Control[];
  reglas: Regla[];
}

interface Props {
  tecnicas: Tecnica[];
}

export default function SeccionTecnicas({ tecnicas }: Props) {
  const [busqueda, setBusqueda] = useState("");
  const [tacticaSeleccionada, setTacticaSeleccionada] = useState("TODAS");
  const [tecnicaExpandida, setTecnicaExpandida] = useState<string | null>(null);

  const getConfidenceBadge = (tipo?: string) => {
    switch (tipo?.toLowerCase()) {
      case "oficial":
        return "bg-emerald-950/80 text-emerald-400 border-emerald-800/60";
      case "comunidad":
        return "bg-amber-950/80 text-amber-400 border-amber-800/60";
      case "propio":
        return "bg-slate-800/80 text-slate-400 border-slate-700/60";
      default:
        return "bg-slate-800/80 text-slate-400 border-slate-700/60";
    }
  };

  // Extraer lista única de tácticas
  const tacticas = ["TODAS", ...Array.from(new Set(tecnicas.map((t) => t.tactica)))];

  // Filtrado reactivo
  const tecnicasFiltradas = tecnicas.filter((t) => {
    const coincideTexto =
      t.id.toLowerCase().includes(busqueda.toLowerCase()) ||
      t.nombre.toLowerCase().includes(busqueda.toLowerCase());
    const coincideTactica =
      tacticaSeleccionada === "TODAS" || t.tactica === tacticaSeleccionada;
    return coincideTexto && coincideTactica;
  });

  const toggleExpandir = (id: string) => {
    setTecnicaExpandida(tecnicaExpandida === id ? null : id);
  };

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-white">
            Matriz MITRE ATT&CK & Mitigaciones
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Técnicas adversarias mapeadas a controles defensivos NIST SP 800-53 y reglas Sigma.
          </p>
        </div>

        {/* Buscador */}
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Buscar por ID o técnica..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
      </div>

      {/* Filtros de tácticas */}
      <div className="flex flex-wrap gap-2 mb-6">
        {tacticas.map((tac) => (
          <button
            key={tac}
            onClick={() => setTacticaSeleccionada(tac)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
              tacticaSeleccionada === tac
                ? "bg-indigo-600 border-indigo-500 text-white font-medium"
                : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
            }`}
          >
            {tac}
          </button>
        ))}
      </div>

      {/* Listado de técnicas */}
      <div className="space-y-3">
        {tecnicasFiltradas.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500">
            No se encontraron técnicas para los filtros aplicados.
          </div>
        ) : (
          tecnicasFiltradas.map((t) => {
            const expandida = tecnicaExpandida === t.id;
            return (
              <div
                key={t.id}
                className="bg-slate-950/60 border border-slate-800/80 rounded-xl overflow-hidden transition-all"
              >
                {/* Cabecera de la tarjeta */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={expandida}
                  onClick={() => toggleExpandir(t.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleExpandir(t.id);
                    }
                  }}
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-800/30 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold text-indigo-400 bg-indigo-950/50 border border-indigo-800/50 px-2.5 py-1 rounded-md">
                      {t.id}
                    </span>
                    <span className="text-sm font-semibold text-white">
                      {t.nombre}
                    </span>
                    <span className="hidden sm:inline-block text-xs text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-md">
                      {t.tactica}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      {t.controles.length > 0 && (
                        <span className="flex items-center gap-1 text-emerald-400">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          {t.controles.length}
                        </span>
                      )}
                      {t.reglas.length > 0 && (
                        <span className="flex items-center gap-1 text-cyan-400">
                          <Terminal className="w-3.5 h-3.5" />
                          {t.reglas.length}
                        </span>
                      )}
                    </div>
                    {expandida ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Contenido expandible */}
                {expandida && (
                  <div className="p-4 pt-0 border-t border-slate-800/60 space-y-4 mt-2">
                    {t.descripcion && (
                      <p className="text-xs text-slate-400 leading-relaxed pt-2">
                        {t.descripcion}
                      </p>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Controles NIST */}
                      <div className="bg-slate-900/80 border border-slate-800/80 p-3.5 rounded-lg">
                        <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 mb-2">
                          <ShieldCheck className="w-4 h-4" />
                          Mitigaciones NIST SP 800-53 (CTID)
                        </div>
                        {t.controles.length === 0 ? (
                          <p className="text-xs text-slate-500">Sin mapeo directo disponible.</p>
                        ) : (
                          <ul className="space-y-2">
                            {t.controles.map((c, idx) => (
                              <li
                                key={`${c.codigo}-${idx}`}
                                className="text-xs text-slate-300 flex items-start justify-between gap-2.5 p-1 rounded hover:bg-slate-800/30 transition-colors"
                              >
                                <div className="flex items-start gap-1.5 flex-1 min-w-0">
                                  <span className="font-mono text-emerald-400 font-medium shrink-0">
                                    {c.codigo}:
                                  </span>
                                  <span className="leading-snug">{c.nombre}</span>
                                </div>
                                {c.tipo_confianza && (
                                  c.fuente_url ? (
                                    <a
                                      href={c.fuente_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className={`text-[10px] px-2 py-0.5 rounded-md border font-semibold tracking-wide shrink-0 transition-opacity hover:opacity-80 ${getConfidenceBadge(
                                        c.tipo_confianza
                                      )}`}
                                      title={c.fuente_nombre ? `Fuente: ${c.fuente_nombre} (Abrir referencia oficial)` : "Abrir referencia"}
                                    >
                                      {c.tipo_confianza}
                                    </a>
                                  ) : (
                                    <span
                                      className={`text-[10px] px-2 py-0.5 rounded-md border font-semibold tracking-wide shrink-0 ${getConfidenceBadge(
                                        c.tipo_confianza
                                      )}`}
                                      title={c.fuente_nombre ? `Fuente: ${c.fuente_nombre}` : undefined}
                                    >
                                      {c.tipo_confianza}
                                    </span>
                                  )
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {/* Reglas Sigma */}
                      <div className="bg-slate-900/80 border border-slate-800/80 p-3.5 rounded-lg">
                        <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 mb-2">
                          <Terminal className="w-4 h-4" />
                          Detecciones SigmaHQ
                        </div>
                        {t.reglas.length === 0 ? (
                          <p className="text-xs text-slate-500">Sin reglas específicas registradas.</p>
                        ) : (
                          <ul className="space-y-1.5">
                            {t.reglas.map((r) => (
                              <li key={r.id} className="text-xs text-slate-300 flex items-start justify-between gap-2">
                                <span>{r.nombre}</span>
                                <span className="font-mono text-[10px] text-cyan-400 bg-cyan-950/60 border border-cyan-800/40 px-1.5 py-0.5 rounded">
                                  {r.formato}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
