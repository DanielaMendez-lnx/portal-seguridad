
"use client";

import { useState, useMemo } from "react";
import {
  ShieldCheck,
  Terminal,
  Search,
  ChevronDown,
  ChevronUp,
  Star,
  Copy,
  Check,
  Loader2,
  X,
  Code2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useFavoritos, type InputNuevoFavorito } from "../../hooks/useFavoritos";

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

export interface ReglaTraduccion {
  formato: string;
  query: string;
  flavor_label?: string | null;
  target_table?: string | null;
}

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

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

const UMBRAL_PAGINACION_REGLAS = 15;

interface ListaReglasSigmaProps {
  reglas: Regla[];
  tecnicaId: string;
  tecnicaNombre: string;
  dominioCodigo: string;
  dominioNombre: string;
  esFavorito: (reglaId: number, tecnicaId: string) => boolean;
  toggleFavorito: (item: InputNuevoFavorito) => void;
}

function ListaReglasSigma({
  reglas,
  tecnicaId,
  tecnicaNombre,
  dominioCodigo,
  dominioNombre,
  esFavorito,
  toggleFavorito,
}: ListaReglasSigmaProps) {
  const [busqueda, setBusqueda] = useState("");
  const [mostrarTodas, setMostrarTodas] = useState(false);

  // Estados locales para traducciones on-demand y expansión de panel
  const [traduccionesCache, setTraduccionesCache] = useState<Record<number, ReglaTraduccion[]>>({});
  const [reglaExpandidaId, setReglaExpandidaId] = useState<number | null>(null);
  const [formatoActivo, setFormatoActivo] = useState<"splunk" | "elastic" | "kql">("splunk");
  const [kqlFlavor, setKqlFlavor] = useState<"defender" | "sentinel">("defender");
  const [cargandoId, setCargandoId] = useState<number | null>(null);
  const [errorId, setErrorId] = useState<number | null>(null);
  const [copiadoKey, setCopiadoKey] = useState<string | null>(null);

  // Ordenar alfabéticamente A-Z de forma determinista
  const reglasOrdenadas = useMemo(() => {
    return [...reglas].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [reglas]);

  // Filtrado in-memory reactivo por nombre o log_source
  const reglasFiltradas = useMemo(() => {
    if (!busqueda.trim()) return reglasOrdenadas;
    const q = busqueda.toLowerCase().trim();
    return reglasOrdenadas.filter(
      (r) =>
        r.nombre.toLowerCase().includes(q) ||
        (r.log_source && r.log_source.toLowerCase().includes(q))
    );
  }, [reglasOrdenadas, busqueda]);

  const tieneMuchasReglas = reglas.length > UMBRAL_PAGINACION_REGLAS;
  const reglasVisibles =
    mostrarTodas || !tieneMuchasReglas
      ? reglasFiltradas
      : reglasFiltradas.slice(0, UMBRAL_PAGINACION_REGLAS);

  const hayMasPorMostrar = !mostrarTodas && tieneMuchasReglas && reglasFiltradas.length > UMBRAL_PAGINACION_REGLAS;

  const handleToggleFormato = async (
    reglaId: number,
    formato: "splunk" | "elastic" | "kql",
    e: React.MouseEvent
  ) => {
    e.stopPropagation();

    // Si ya está expandida con este mismo formato, colapsamos
    if (reglaExpandidaId === reglaId && formatoActivo === formato) {
      setReglaExpandidaId(null);
      return;
    }

    setReglaExpandidaId(reglaId);
    setFormatoActivo(formato);
    setErrorId(null);

    // Si ya está en caché
    if (traduccionesCache[reglaId] !== undefined) {
      if (formato === "kql") {
        const trads = traduccionesCache[reglaId];
        const tieneDefender = trads.some((t) => t.formato === "kql_defender");
        setKqlFlavor(tieneDefender ? "defender" : "sentinel");
      }
      return;
    }

    // Consultar API on-demand
    setCargandoId(reglaId);
    try {
      const res = await fetch(`${API_BASE}/reglas/${reglaId}/traducciones`);
      if (!res.ok) {
        throw new Error(`Error ${res.status}`);
      }
      const data: ReglaTraduccion[] = await res.json();
      setTraduccionesCache((prev) => ({ ...prev, [reglaId]: data }));

      if (formato === "kql") {
        const tieneDefender = data.some((t) => t.formato === "kql_defender");
        setKqlFlavor(tieneDefender ? "defender" : "sentinel");
      }
    } catch (err) {
      console.error(`Error al cargar traducciones para regla ${reglaId}:`, err);
      setErrorId(reglaId);
    } finally {
      setCargandoId(null);
    }
  };

  const handleCopiarQuery = async (texto: string, clave: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(texto);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = texto;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopiadoKey(clave);
      setTimeout(() => {
        setCopiadoKey((prev) => (prev === clave ? null : prev));
      }, 2000);
    } catch (err) {
      console.error("Error al copiar al portapapeles:", err);
    }
  };

  return (
    <div className="bg-umbra-surface/80 border border-umbra-line p-3.5 rounded-lg flex flex-col">
      {/* Cabecera de la sección de reglas con total real */}
      <div className="flex items-center justify-between text-xs font-bold text-umbra-cyan mb-2.5">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4" />
          <span>Detecciones SigmaHQ</span>
          <span className="font-mono text-[10px] text-umbra-cyan bg-umbra-cyan/10 border border-umbra-cyan/30 px-1.5 py-0.5 rounded font-normal">
            {reglas.length}
          </span>
        </div>
        <a
          href="https://github.com/SigmaHQ/Detection-Rule-License"
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-[11px] font-mono font-normal text-umbra-ink-muted hover:text-umbra-cyan hover:underline transition-colors"
        >
          Reglas: SigmaHQ · DRL 1.1 ↗
        </a>
      </div>

      {/* Buscador contextual si supera el umbral */}
      {tieneMuchasReglas && (
        <div className="mb-3 space-y-1.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-umbra-ink-dim absolute left-2.5 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder={`Buscar entre las ${reglas.length} reglas (ej. LOLBin, memory, inject)...`}
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="w-full bg-umbra-bg border border-umbra-line rounded-lg pl-8 pr-7 py-1.5 text-xs text-umbra-ink placeholder-umbra-ink-muted focus:outline-none focus:border-umbra-cyan/50 focus:ring-1 focus:ring-umbra-cyan/30 transition-colors"
            />
            {busqueda && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setBusqueda("");
                }}
                className="absolute right-2 top-2 text-umbra-ink-dim hover:text-umbra-ink text-xs p-0.5 rounded hover:bg-umbra-surface"
                title="Limpiar búsqueda"
                aria-label="Limpiar búsqueda de reglas"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] text-umbra-ink-dim px-0.5">
            <span>
              {busqueda ? (
                <>Mostrando {reglasVisibles.length} de {reglasFiltradas.length} coincidencias ({reglas.length} totales)</>
              ) : (
                <>Mostrando {reglasVisibles.length} de {reglas.length} reglas (orden A-Z)</>
              )}
            </span>
          </div>
        </div>
      )}

      {/* Lista de reglas */}
      {reglas.length === 0 ? (
        <p className="text-xs text-umbra-ink-muted">Sin reglas específicas registradas.</p>
      ) : reglasFiltradas.length === 0 ? (
        <div className="py-4 text-center text-xs text-umbra-ink-muted border border-dashed border-umbra-line/60 rounded-md">
          No se encontraron reglas que coincidan con &ldquo;{busqueda}&rdquo;.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {reglasVisibles.map((r) => {
            const favorita = esFavorito(r.id, tecnicaId);
            const estaExpandida = reglaExpandidaId === r.id;
            const trads = traduccionesCache[r.id];
            const yaConsultada = trads !== undefined;
            const sinTraducciones = yaConsultada && trads.length === 0;

            // Extraer traducciones específicas si ya están en caché
            const tradSplunk = trads?.find((t) => t.formato === "splunk");
            const tradElastic = trads?.find((t) => t.formato === "elastic");
            const tradDefender = trads?.find((t) => t.formato === "kql_defender");
            const tradSentinel = trads?.find((t) => t.formato === "kql_sentinel");

            // Determinar la traducción activa actual para el panel
            let tradActual: ReglaTraduccion | undefined;
            if (formatoActivo === "splunk") {
              tradActual = tradSplunk;
            } else if (formatoActivo === "elastic") {
              tradActual = tradElastic;
            } else if (formatoActivo === "kql") {
              tradActual = (kqlFlavor === "defender" && tradDefender) ? tradDefender : (tradSentinel || tradDefender);
            }

            return (
              <li
                key={r.id}
                className={`text-xs text-umbra-ink flex flex-col p-2 rounded-lg transition-all duration-150 ${
                  estaExpandida
                    ? "bg-umbra-surface/95 border border-umbra-cyan/40 shadow-sm shadow-umbra-cyan/10 ring-1 ring-umbra-cyan/20"
                    : "bg-transparent border border-transparent hover:bg-umbra-surface-hover/60"
                }`}
              >
                {/* Fila principal de la regla */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorito({
                          regla_id: r.id,
                          regla_nombre: r.nombre,
                          regla_formato: r.formato,
                          url_fuente: r.url_fuente ?? null,
                          tecnica_id: tecnicaId,
                          tecnica_nombre: tecnicaNombre,
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
                          ? `Quitar regla de repertorio (${tecnicaId})`
                          : `Guardar regla en repertorio (${tecnicaId})`
                      }
                      aria-label={
                        favorita
                          ? `Quitar ${r.nombre} de favoritos en técnica ${tecnicaId}`
                          : `Guardar ${r.nombre} en favoritos en técnica ${tecnicaId}`
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
                    <span
                      className={`leading-snug truncate ${estaExpandida ? "font-semibold text-umbra-ink" : ""}`}
                      title={r.nombre}
                    >
                      {r.nombre}
                    </span>
                  </div>

                  {/* Acciones: Badges de SIEM/XDR y enlace a fuente */}
                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto flex-wrap">
                    {/* Botón Splunk */}
                    <button
                      type="button"
                      disabled={sinTraducciones}
                      onClick={(e) => handleToggleFormato(r.id, "splunk", e)}
                      title={
                        sinTraducciones
                          ? "Sin traducciones disponibles para esta regla"
                          : estaExpandida && formatoActivo === "splunk"
                          ? "Ocultar consulta Splunk"
                          : "Ver consulta Splunk SPL"
                      }
                      className={`font-mono text-[10px] px-2 py-0.5 rounded border transition-all cursor-pointer inline-flex items-center gap-1 ${
                        estaExpandida && formatoActivo === "splunk"
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/60 font-bold shadow-sm shadow-amber-500/10"
                          : sinTraducciones
                          ? "bg-umbra-bg/40 text-umbra-ink-muted/50 border-umbra-line/40 opacity-40 cursor-not-allowed"
                          : "bg-umbra-bg text-umbra-ink-dim border-umbra-line hover:text-amber-300 hover:border-amber-500/40 hover:bg-umbra-surface"
                      }`}
                    >
                      {cargandoId === r.id && formatoActivo === "splunk" ? (
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      ) : null}
                      Splunk
                    </button>

                    {/* Botón Elastic */}
                    <button
                      type="button"
                      disabled={sinTraducciones}
                      onClick={(e) => handleToggleFormato(r.id, "elastic", e)}
                      title={
                        sinTraducciones
                          ? "Sin traducciones disponibles para esta regla"
                          : estaExpandida && formatoActivo === "elastic"
                          ? "Ocultar consulta Elasticsearch"
                          : "Ver consulta Elasticsearch Lucene (ECS)"
                      }
                      className={`font-mono text-[10px] px-2 py-0.5 rounded border transition-all cursor-pointer inline-flex items-center gap-1 ${
                        estaExpandida && formatoActivo === "elastic"
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/60 font-bold shadow-sm shadow-emerald-500/10"
                          : sinTraducciones
                          ? "bg-umbra-bg/40 text-umbra-ink-muted/50 border-umbra-line/40 opacity-40 cursor-not-allowed"
                          : "bg-umbra-bg text-umbra-ink-dim border-umbra-line hover:text-emerald-300 hover:border-emerald-500/40 hover:bg-umbra-surface"
                      }`}
                    >
                      {cargandoId === r.id && formatoActivo === "elastic" ? (
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      ) : null}
                      Elastic
                    </button>

                    {/* Botón KQL (Opción B: badge único) */}
                    <button
                      type="button"
                      disabled={sinTraducciones}
                      onClick={(e) => handleToggleFormato(r.id, "kql", e)}
                      title={
                        sinTraducciones
                          ? "Sin traducciones disponibles para esta regla"
                          : estaExpandida && formatoActivo === "kql"
                          ? "Ocultar consulta KQL"
                          : "Ver consulta Microsoft KQL (Defender XDR / Sentinel)"
                      }
                      className={`font-mono text-[10px] px-2 py-0.5 rounded border transition-all cursor-pointer inline-flex items-center gap-1 ${
                        estaExpandida && formatoActivo === "kql"
                          ? "bg-sky-500/20 text-sky-300 border-sky-500/60 font-bold shadow-sm shadow-sky-500/10"
                          : sinTraducciones
                          ? "bg-umbra-bg/40 text-umbra-ink-muted/50 border-umbra-line/40 opacity-40 cursor-not-allowed"
                          : "bg-umbra-bg text-umbra-ink-dim border-umbra-line hover:text-sky-300 hover:border-sky-500/40 hover:bg-umbra-surface"
                      }`}
                    >
                      {cargandoId === r.id && formatoActivo === "kql" ? (
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      ) : null}
                      KQL
                    </button>

                    {r.url_fuente && (
                      <a
                        href={r.url_fuente}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-[11px] text-umbra-cyan hover:underline shrink-0 inline-flex items-center gap-1 font-medium transition-colors ml-1"
                        title="Ver YAML oficial en repositorio SigmaHQ"
                      >
                        Ver regla ↗
                      </a>
                    )}
                  </div>
                </div>

                {/* Panel expandible de código de la consulta */}
                {estaExpandida && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="mt-2.5 pt-2.5 border-t border-umbra-line/70 flex flex-col gap-2 bg-umbra-bg/90 p-3 rounded-lg border border-umbra-line/50"
                  >
                    {/* Barra de título y selectores de sabor */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Code2 className="w-3.5 h-3.5 text-umbra-cyan shrink-0" />
                        <span className="text-xs font-semibold text-umbra-ink">
                          {formatoActivo === "splunk" && "Splunk SPL"}
                          {formatoActivo === "elastic" && "Elasticsearch Lucene (ECS)"}
                          {formatoActivo === "kql" && "Microsoft KQL"}
                        </span>

                        {/* Selector de Sabores KQL si ambos aplican */}
                        {formatoActivo === "kql" && tradDefender && tradSentinel && (
                          <div className="inline-flex items-center rounded-md bg-umbra-surface p-0.5 border border-umbra-line text-[10px]">
                            <button
                              type="button"
                              onClick={() => setKqlFlavor("defender")}
                              className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                                kqlFlavor === "defender"
                                  ? "bg-sky-500/20 text-sky-300 font-semibold border border-sky-500/40"
                                  : "text-umbra-ink-dim hover:text-umbra-ink"
                              }`}
                            >
                              Defender XDR {tradDefender.target_table ? `(${tradDefender.target_table})` : ""}
                            </button>
                            <button
                              type="button"
                              onClick={() => setKqlFlavor("sentinel")}
                              className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                                kqlFlavor === "sentinel"
                                  ? "bg-sky-500/20 text-sky-300 font-semibold border border-sky-500/40"
                                  : "text-umbra-ink-dim hover:text-umbra-ink"
                              }`}
                            >
                              Azure Sentinel
                            </button>
                          </div>
                        )}

                        {/* Indicador individual si solo hay Sentinel */}
                        {formatoActivo === "kql" && !tradDefender && tradSentinel && (
                          <span className="font-mono text-[10px] text-umbra-ink-dim bg-umbra-surface border border-umbra-line px-1.5 py-0.5 rounded">
                            Azure Sentinel / Log Analytics
                          </span>
                        )}

                        {/* Indicador individual si solo hay Defender */}
                        {formatoActivo === "kql" && tradDefender && !tradSentinel && (
                          <span className="font-mono text-[10px] text-umbra-ink-dim bg-umbra-surface border border-umbra-line px-1.5 py-0.5 rounded">
                            Defender XDR {tradDefender.target_table ? `(${tradDefender.target_table})` : ""}
                          </span>
                        )}
                      </div>

                      {/* Botones de acción: Copiar y Cerrar */}
                      <div className="flex items-center gap-1.5">
                        {tradActual && (
                          <button
                            type="button"
                            onClick={(e) =>
                              handleCopiarQuery(
                                tradActual!.query,
                                `${r.id}-${formatoActivo}-${kqlFlavor}`,
                                e
                              )
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-umbra-surface hover:bg-umbra-surface-hover text-umbra-ink border border-umbra-line transition-colors cursor-pointer"
                            title="Copiar consulta al portapapeles"
                          >
                            {copiadoKey === `${r.id}-${formatoActivo}-${kqlFlavor}` ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-emerald-400 font-semibold">¡Copiado!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-umbra-ink-dim" />
                                <span>Copiar</span>
                              </>
                            )}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setReglaExpandidaId(null)}
                          className="p-1 rounded text-umbra-ink-dim hover:text-umbra-ink hover:bg-umbra-surface transition-colors cursor-pointer"
                          title="Cerrar vista de consulta"
                          aria-label="Cerrar vista de consulta"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Estados del panel: cargando, error, sin traducciones, o consulta lista */}
                    {cargandoId === r.id ? (
                      <div className="flex items-center justify-center gap-2 py-6 text-xs text-umbra-ink-muted">
                        <Loader2 className="w-4 h-4 animate-spin text-umbra-cyan" />
                        <span>Cargando traducción precomputada...</span>
                      </div>
                    ) : errorId === r.id ? (
                      <div className="py-2.5 px-3 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-md">
                        No se pudo obtener la traducción de la regla. Verifique la conexión con el servidor.
                      </div>
                    ) : sinTraducciones ? (
                      <div className="py-2.5 px-3 text-xs text-umbra-ink-muted bg-umbra-surface/50 border border-umbra-line/40 rounded-md">
                        Esta regla no cuenta con traducciones precomputadas para los backends disponibles (sintaxis no soportada por el estándar de conversión).
                      </div>
                    ) : tradActual ? (
                      <div className="space-y-1.5">
                        <pre className="p-3 bg-umbra-bg/95 border border-umbra-line/80 rounded-md font-mono text-[11px] text-umbra-ink overflow-x-auto whitespace-pre-wrap break-all leading-relaxed select-all">
                          <code>{tradActual.query}</code>
                        </pre>
                        {tradActual.target_table && (
                          <div className="text-[10px] text-umbra-ink-dim font-mono">
                            Tabla objetivo (schema M365D):{" "}
                            <span className="text-sky-300 font-semibold">{tradActual.target_table}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="py-2.5 px-3 text-xs text-umbra-ink-muted bg-umbra-surface/50 border border-umbra-line/40 rounded-md">
                        No hay traducción disponible para este formato específico.
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Botón de alternar Mostrar todas / Mostrar menos */}
      {tieneMuchasReglas && (
        <div className="mt-3 pt-2.5 border-t border-umbra-line/60 flex items-center justify-center">
          {hayMasPorMostrar ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMostrarTodas(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-umbra-bg hover:bg-umbra-surface-hover text-umbra-cyan border border-umbra-cyan/30 hover:border-umbra-cyan/60 transition-all cursor-pointer shadow-sm hover:shadow-umbra-cyan/10"
            >
              <span>Mostrar todas ({reglasFiltradas.length})</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          ) : mostrarTodas && reglasFiltradas.length > UMBRAL_PAGINACION_REGLAS ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMostrarTodas(false);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-umbra-bg hover:bg-umbra-surface-hover text-umbra-ink-dim hover:text-umbra-ink border border-umbra-line hover:border-umbra-line/80 transition-all cursor-pointer"
            >
              <span>Mostrar menos ({UMBRAL_PAGINACION_REGLAS})</span>
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
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

  const hayProtocolos = tecnicas.some((t) => t.protocolo && t.protocolo.toUpperCase() !== "GENERAL");

  // Contadores dinámicos por protocolo
  const conteoProtocolos: Record<FiltroProtocolo, number> = {
    TODOS: tecnicas.length,
    DNS: tecnicas.filter((t) => (t.protocolo || "").toUpperCase() === "DNS").length,
    SMB: tecnicas.filter((t) => t.protocolo?.toUpperCase() === "SMB").length,
    FTP: tecnicas.filter((t) => t.protocolo?.toUpperCase() === "FTP").length,
    CORE_L2_L3: tecnicas.filter((t) => ["DHCP", "ARP"].includes((t.protocolo || "").toUpperCase())).length,
    GENERAL: tecnicas.filter((t) => (t.protocolo || "").toUpperCase() === "GENERAL").length,
  };

  // Extraer lista única de tácticas
  const tacticas = ["TODAS", ...Array.from(new Set(tecnicas.map((t) => t.tactica)))];

  // Filtrado reactivo combinado: Protocolo + Texto + Táctica
  const tecnicasFiltradas = tecnicas.filter((t) => {
    let coincideProtocolo = true;
    if (hayProtocolos) {
      const proto = (t.protocolo || "").toUpperCase();
      if (protocoloSeleccionado === "DNS") coincideProtocolo = proto === "DNS";
      else if (protocoloSeleccionado === "SMB") coincideProtocolo = proto === "SMB";
      else if (protocoloSeleccionado === "FTP") coincideProtocolo = proto === "FTP";
      else if (protocoloSeleccionado === "CORE_L2_L3") coincideProtocolo = ["DHCP", "ARP"].includes(proto);
      else if (protocoloSeleccionado === "GENERAL") coincideProtocolo = proto === "GENERAL";
    }

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

      {/* Selector Primario: Filtros por Protocolo (solo si el dominio clasifica por protocolos) */}
      {hayProtocolos && (
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
      )}

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
                    {t.protocolo && (
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border tracking-wider shrink-0 ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    )}
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
                      <ListaReglasSigma
                        reglas={t.reglas}
                        tecnicaId={t.id}
                        tecnicaNombre={t.nombre}
                        dominioCodigo={dominioCodigo}
                        dominioNombre={dominioNombre}
                        esFavorito={esFavorito}
                        toggleFavorito={toggleFavorito}
                      />
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
