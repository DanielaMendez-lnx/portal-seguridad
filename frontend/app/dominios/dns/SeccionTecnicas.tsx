
"use client";

import { useState } from "react";
import { ShieldCheck, Terminal, Search, ChevronDown, ChevronUp, Star } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useFavoritos } from "../../hooks/useFavoritos";

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
  url_fuente?: string | null;
}

export interface Tecnica {
  id: string;
  nombre: string;
  tactica: string;
  protocolo?: string;
  descripcion: string | null;
  controles: Control[];
  reglas: Regla[];
}

export type FiltroProtocolo = "TODOS" | "DNS" | "SMB" | "FTP" | "CORE_L2_L3" | "GENERAL";

const PROTOCOLOS_CONFIG: { key: FiltroProtocolo; label: string }[] = [
  { key: "TODOS", label: "Todos" },
  { key: "DNS", label: "DNS" },
  { key: "SMB", label: "SMB" },
  { key: "FTP", label: "FTP" },
  { key: "CORE_L2_L3", label: "Core L2/L3" },
  { key: "GENERAL", label: "General de Red" },
];

interface Props {
  tecnicas: Tecnica[];
  dominioCodigo?: string;
  dominioNombre?: string;
}

function limpiarDescripcionMitre(texto: string): string {
  return texto
    .replace(/\s*\(Citation:[^)]+\)/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+\./g, ".")
    .trim();
}

export default function SeccionTecnicas({
  tecnicas,
  dominioCodigo = "NET-INFRA",
  dominioNombre = "Network Infrastructure & Protocols",
}: Props) {
  const { esFavorito, toggleFavorito } = useFavoritos();
  const [protocoloSeleccionado, setProtocoloSeleccionado] = useState<FiltroProtocolo>("TODOS");
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

  const getProtocolBadge = (protocolo?: string) => {
    switch (protocolo?.toUpperCase()) {
      case "DNS":
        return {
          label: "DNS",
          className: "bg-sky-500/10 text-sky-400 border-sky-500/30",
        };
      case "SMB":
        return {
          label: "SMB",
          className: "bg-amber-500/10 text-amber-400 border-amber-500/30",
        };
      case "FTP":
        return {
          label: "FTP / TFTP",
          className: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
        };
      case "DHCP":
        return {
          label: "DHCP",
          className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
        };
      case "ARP":
        return {
          label: "ARP",
          className: "bg-purple-500/10 text-purple-400 border-purple-500/30",
        };
      case "GENERAL":
      default:
        return {
          label: "RED GENERAL",
          className: "bg-slate-500/10 text-slate-300 border-slate-500/30",
        };
    }
  };

  // Contadores dinámicos por protocolo
  const conteoProtocolos: Record<FiltroProtocolo, number> = {
    TODOS: tecnicas.length,
    DNS: tecnicas.filter((t) => (t.protocolo || "DNS").toUpperCase() === "DNS").length,
    SMB: tecnicas.filter((t) => t.protocolo?.toUpperCase() === "SMB").length,
    FTP: tecnicas.filter((t) => t.protocolo?.toUpperCase() === "FTP").length,
    CORE_L2_L3: tecnicas.filter((t) => ["DHCP", "ARP"].includes((t.protocolo || "").toUpperCase())).length,
    GENERAL: tecnicas.filter((t) => (t.protocolo || "").toUpperCase() === "GENERAL").length,
  };

  // Extraer lista única de tácticas
  const tacticas = ["TODAS", ...Array.from(new Set(tecnicas.map((t) => t.tactica)))];

  // Filtrado reactivo combinado: Protocolo + Texto + Táctica
  const tecnicasFiltradas = tecnicas.filter((t) => {
    const proto = (t.protocolo || "DNS").toUpperCase();

    let coincideProtocolo = true;
    if (protocoloSeleccionado === "DNS") coincideProtocolo = proto === "DNS";
    else if (protocoloSeleccionado === "SMB") coincideProtocolo = proto === "SMB";
    else if (protocoloSeleccionado === "FTP") coincideProtocolo = proto === "FTP";
    else if (protocoloSeleccionado === "CORE_L2_L3") coincideProtocolo = ["DHCP", "ARP"].includes(proto);
    else if (protocoloSeleccionado === "GENERAL") coincideProtocolo = proto === "GENERAL";

    const coincideTexto =
      t.id.toLowerCase().includes(busqueda.toLowerCase()) ||
      t.nombre.toLowerCase().includes(busqueda.toLowerCase());
    const coincideTactica =
      tacticaSeleccionada === "TODAS" || t.tactica === tacticaSeleccionada;

    return coincideProtocolo && coincideTexto && coincideTactica;
  });

  const toggleExpandir = (id: string) => {
    setTecnicaExpandida(tecnicaExpandida === id ? null : id);
  };

  return (
    <section className="bg-umbra-surface border border-umbra-line rounded-2xl p-6 mb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-umbra-ink">
            Matriz MITRE ATT&CK & Mitigaciones
          </h2>
          <p className="text-xs text-umbra-ink-dim mt-0.5">
            Técnicas adversarias mapeadas a controles defensivos NIST SP 800-53 y reglas Sigma.
          </p>
        </div>

        {/* Buscador */}
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-umbra-ink-dim absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Buscar por ID o técnica..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full bg-umbra-bg border border-umbra-line rounded-xl pl-9 pr-4 py-1.5 text-xs text-umbra-ink placeholder-umbra-ink-muted focus:outline-none focus:border-umbra-cyan/50 focus:ring-1 focus:ring-umbra-cyan/30 transition-colors"
          />
        </div>
      </div>

      {/* Selector Primario: Filtros por Protocolo */}
      <div className="mb-5 pb-5 border-b border-umbra-line/70">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs font-semibold text-umbra-ink uppercase tracking-wider">
            Vector de Protocolo
          </span>
          <span className="text-[11px] text-umbra-ink-dim">
            Mostrando {tecnicasFiltradas.length} de {tecnicas.length} técnicas
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {PROTOCOLOS_CONFIG.map((p) => {
            const activo = protocoloSeleccionado === p.key;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => setProtocoloSeleccionado(p.key)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
                  activo
                    ? "bg-umbra-cyan/20 border-umbra-cyan text-umbra-cyan font-semibold shadow-sm shadow-umbra-cyan/20"
                    : "bg-umbra-bg border-umbra-line text-umbra-ink-dim hover:border-white/20 hover:text-umbra-ink"
                }`}
              >
                <span>{p.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                    activo
                      ? "bg-umbra-cyan/30 text-umbra-cyan font-bold"
                      : "bg-umbra-surface text-umbra-ink-muted"
                  }`}
                >
                  {conteoProtocolos[p.key]}
                </span>
              </button>
            );
          })}
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
                ? "bg-umbra-cyan/15 border-umbra-cyan/50 text-umbra-cyan font-medium shadow-sm shadow-umbra-cyan/10"
                : "bg-umbra-bg border-umbra-line text-umbra-ink-dim hover:border-white/20 hover:text-umbra-ink"
            }`}
          >
            {tac}
          </button>
        ))}
      </div>

      {/* Listado de técnicas */}
      <div className="space-y-3">
        {tecnicasFiltradas.length === 0 ? (
          <div className="text-center py-8 text-xs text-umbra-ink-muted">
            No se encontraron técnicas para los filtros aplicados.
          </div>
        ) : (
          tecnicasFiltradas.map((t) => {
            const expandida = tecnicaExpandida === t.id;
            const badge = getProtocolBadge(t.protocolo);
            return (
              <div
                key={t.id}
                className="bg-umbra-bg/60 border border-umbra-line rounded-xl overflow-hidden transition-all"
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
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-umbra-surface-hover/50 transition-colors focus:outline-none focus:ring-2 focus:ring-umbra-cyan/50 rounded-xl"
                >
                  <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
                    <span className="font-mono text-xs font-bold text-umbra-cyan bg-umbra-cyan/10 border border-umbra-cyan/30 px-2.5 py-1 rounded-md shrink-0">
                      {t.id}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border tracking-wider shrink-0 ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                    <span className="text-sm font-semibold text-umbra-ink">
                      {t.nombre}
                    </span>
                    <span className="hidden sm:inline-block text-xs text-umbra-ink-dim bg-umbra-surface border border-umbra-line px-2 py-0.5 rounded-md shrink-0">
                      {t.tactica}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-xs text-umbra-ink-dim">
                      {t.controles.length > 0 && (
                        <span className="flex items-center gap-1 text-emerald-400">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          {t.controles.length}
                        </span>
                      )}
                      {t.reglas.length > 0 && (
                        <span className="flex items-center gap-1 text-umbra-cyan">
                          <Terminal className="w-3.5 h-3.5" />
                          {t.reglas.length}
                        </span>
                      )}
                    </div>
                    {expandida ? (
                      <ChevronUp className="w-4 h-4 text-umbra-ink-dim" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-umbra-ink-dim" />
                    )}
                  </div>
                </div>

                {/* Contenido expandible */}
                {expandida && (
                  <div className="p-4 pt-0 border-t border-umbra-line space-y-4 mt-2">
                    {t.descripcion && (
                      <div className="text-xs text-umbra-ink-dim leading-relaxed pt-2">
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                            a: ({ href, children }) => (
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-umbra-cyan hover:underline underline-offset-2 font-medium transition-colors"
                              >
                                {children}
                              </a>
                            ),
                            strong: ({ children }) => <strong className="text-umbra-ink font-semibold">{children}</strong>,
                            code: ({ children }) => (
                              <code className="font-mono text-[11px] bg-umbra-bg text-umbra-cyan px-1.5 py-0.5 rounded border border-umbra-line">
                                {children}
                              </code>
                            ),
                            ul: ({ children }) => <ul className="list-disc pl-4 space-y-1 mb-2">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal pl-4 space-y-1 mb-2">{children}</ol>,
                            li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                          }}
                        >
                          {limpiarDescripcionMitre(t.descripcion)}
                        </ReactMarkdown>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Controles NIST */}
                      <div className="bg-umbra-surface/80 border border-umbra-line p-3.5 rounded-lg">
                        <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 mb-2">
                          <ShieldCheck className="w-4 h-4" />
                          Mitigaciones NIST SP 800-53 (CTID)
                        </div>
                        {t.controles.length === 0 ? (
                          <p className="text-xs text-umbra-ink-muted">Sin mapeo directo disponible.</p>
                        ) : (
                          <ul className="space-y-2">
                            {t.controles.map((c, idx) => (
                              <li
                                key={`${c.codigo}-${idx}`}
                                className="text-xs text-umbra-ink flex items-start justify-between gap-2.5 p-1 rounded hover:bg-umbra-surface-hover/60 transition-colors"
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
                      <div className="bg-umbra-surface/80 border border-umbra-line p-3.5 rounded-lg">
                        <div className="flex items-center gap-2 text-xs font-bold text-umbra-cyan mb-2">
                          <Terminal className="w-4 h-4" />
                          Detecciones SigmaHQ
                        </div>
                        {t.reglas.length === 0 ? (
                          <p className="text-xs text-umbra-ink-muted">Sin reglas específicas registradas.</p>
                        ) : (
                          <ul className="space-y-1.5">
                            {t.reglas.map((r) => {
                              const favorita = esFavorito(r.id, t.id);
                              return (
                                <li
                                  key={r.id}
                                  className="text-xs text-umbra-ink flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-1.5 rounded hover:bg-umbra-surface-hover/60 transition-colors"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    {/* Botón de Estrella contextual: Regla + Técnica + Dominio */}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleFavorito({
                                          regla_id: r.id,
                                          regla_nombre: r.nombre,
                                          regla_formato: r.formato,
                                          url_fuente: r.url_fuente ?? null,
                                          tecnica_id: t.id,
                                          tecnica_nombre: t.nombre,
                                          dominio_codigo: dominioCodigo,
                                          dominio_nombre: dominioNombre,
                                        });
                                      }}
                                      className={`p-1 rounded-md transition-colors shrink-0 focus:outline-none focus:ring-1 focus:ring-amber-400/50 ${
                                        favorita
                                          ? "text-amber-400 hover:text-amber-300"
                                          : "text-umbra-ink-muted hover:text-amber-300 hover:bg-umbra-surface"
                                      }`}
                                      title={
                                        favorita
                                          ? `Quitar regla de repertorio (${t.id})`
                                          : `Guardar regla en repertorio (${t.id})`
                                      }
                                      aria-label={
                                        favorita
                                          ? `Quitar ${r.nombre} de favoritos en técnica ${t.id}`
                                          : `Guardar ${r.nombre} en favoritos en técnica ${t.id}`
                                      }
                                    >
                                      <Star
                                        className={`w-3.5 h-3.5 transition-transform active:scale-125 ${
                                          favorita ? "fill-amber-400 stroke-amber-400" : "stroke-current fill-none"
                                        }`}
                                      />
                                    </button>

                                    <span className="font-mono text-[10px] text-umbra-cyan bg-umbra-cyan/10 border border-umbra-cyan/30 px-1.5 py-0.5 rounded shrink-0">
                                      {r.formato}
                                    </span>
                                    <span className="leading-snug truncate" title={r.nombre}>{r.nombre}</span>
                                  </div>
                                  {r.url_fuente && (
                                    <a
                                      href={r.url_fuente}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="text-[11px] text-umbra-cyan hover:underline shrink-0 inline-flex items-center gap-1 font-medium transition-colors"
                                    >
                                      Ver regla completa ↗
                                    </a>
                                  )}
                                </li>
                              );
                            })}
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
