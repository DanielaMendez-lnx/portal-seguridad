"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bookmark,
  Download,
  Trash2,
  CheckSquare,
  Square,
  MinusSquare,
  Globe,
  ArrowRight,
} from "lucide-react";
import { useFavoritos, ReglaFavorita } from "../hooks/useFavoritos";

interface AgrupacionTecnica {
  tecnica_id: string;
  tecnica_nombre: string;
  reglas: ReglaFavorita[];
}

interface AgrupacionDominio {
  dominio_codigo: string;
  dominio_nombre: string;
  tecnicas: AgrupacionTecnica[];
}

export default function RepertorioPage() {
  const { favoritos, totalFavoritos, quitarFavorito, limpiarTodos } = useFavoritos();
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [mostrarConfirmLimpiar, setMostrarConfirmLimpiar] = useState<boolean>(false);

  // Inicializar o sincronizar la selección con los favoritos existentes
  // Si cambia la lista de favoritos, filtramos las llaves que ya no existan
  const llavesExistentes = useMemo(() => new Set(favoritos.map((f) => f.key)), [favoritos]);

  const seleccionValida = useMemo(() => {
    const valida = new Set<string>();
    for (const key of seleccionados) {
      if (llavesExistentes.has(key)) {
        valida.add(key);
      }
    }
    return valida;
  }, [seleccionados, llavesExistentes]);

  // Agrupación jerárquica: Dominio -> Técnica -> Reglas
  const agrupadoPorDominio = useMemo((): AgrupacionDominio[] => {
    const mapaDominios = new Map<string, { nombre: string; tecnicas: Map<string, { nombre: string; reglas: ReglaFavorita[] }> }>();

    for (const fav of favoritos) {
      const domCod = fav.dominio_codigo || "GENERAL";
      const domNom = fav.dominio_nombre || domCod;

      if (!mapaDominios.has(domCod)) {
        mapaDominios.set(domCod, {
          nombre: domNom,
          tecnicas: new Map(),
        });
      }

      const domObj = mapaDominios.get(domCod)!;
      if (!domObj.tecnicas.has(fav.tecnica_id)) {
        domObj.tecnicas.set(fav.tecnica_id, {
          nombre: fav.tecnica_nombre,
          reglas: [],
        });
      }

      domObj.tecnicas.get(fav.tecnica_id)!.reglas.push(fav);
    }

    const resultado: AgrupacionDominio[] = [];
    for (const [domCod, domData] of mapaDominios.entries()) {
      const tecnicasArray: AgrupacionTecnica[] = [];
      for (const [tecId, tecData] of domData.tecnicas.entries()) {
        tecnicasArray.push({
          tecnica_id: tecId,
          tecnica_nombre: tecData.nombre,
          reglas: tecData.reglas,
        });
      }
      resultado.push({
        dominio_codigo: domCod,
        dominio_nombre: domData.nombre,
        tecnicas: tecnicasArray,
      });
    }

    return resultado;
  }, [favoritos]);

  // Manejadores de selección
  const toggleSeleccionarTodo = () => {
    if (seleccionValida.size === favoritos.length) {
      setSeleccionados(new Set());
    } else {
      setSeleccionados(new Set(favoritos.map((f) => f.key)));
    }
  };

  const toggleSeleccionRegla = (key: string) => {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleSeleccionTecnica = (reglas: ReglaFavorita[]) => {
    const todasEstan = reglas.every((r) => seleccionValida.has(r.key));
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (todasEstan) {
        reglas.forEach((r) => next.delete(r.key));
      } else {
        reglas.forEach((r) => next.add(r.key));
      }
      return next;
    });
  };

  const toggleSeleccionDominio = (dominio: AgrupacionDominio) => {
    const todasLasReglas = dominio.tecnicas.flatMap((t) => t.reglas);
    const todasEstan = todasLasReglas.every((r) => seleccionValida.has(r.key));
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (todasEstan) {
        todasLasReglas.forEach((r) => next.delete(r.key));
      } else {
        todasLasReglas.forEach((r) => next.add(r.key));
      }
      return next;
    });
  };

  // Exportar a Markdown
  const exportarAMarkdown = () => {
    // Si no hay seleccionados individualmente, exportamos todas las de la lista
    const llavesAExportar = seleccionValida.size > 0 ? seleccionValida : llavesExistentes;
    const reglasAExportar = favoritos.filter((f) => llavesAExportar.has(f.key));

    if (reglasAExportar.length === 0) return;

    const fechaHoy = new Date().toISOString().split("T")[0];

    // Construir jerarquía para el archivo Markdown:
    // ## Dominio -> ### Técnica — ID -> - Regla (Formato) — Enlace
    const lineas: string[] = [
      "# Repertorio de Detección — Umbra Radar",
      `*Reporte generado el: ${fechaHoy}*`,
      `*Total de reglas seleccionadas: ${reglasAExportar.length}*`,
      "",
    ];

    // Reagrupar sólo las seleccionadas
    const mapaDom = new Map<string, { nombre: string; tecnicas: Map<string, { nombre: string; reglas: ReglaFavorita[] }> }>();

    for (const r of reglasAExportar) {
      if (!mapaDom.has(r.dominio_codigo)) {
        mapaDom.set(r.dominio_codigo, { nombre: r.dominio_nombre, tecnicas: new Map() });
      }
      const dom = mapaDom.get(r.dominio_codigo)!;
      if (!dom.tecnicas.has(r.tecnica_id)) {
        dom.tecnicas.set(r.tecnica_id, { nombre: r.tecnica_nombre, reglas: [] });
      }
      dom.tecnicas.get(r.tecnica_id)!.reglas.push(r);
    }

    function escaparMarkdown(texto: string): string {
      if (!texto) return "";
      return texto.replace(/([\\`*_\[\]])/g, "\\$1");
    }

    for (const [, domData] of mapaDom.entries()) {
      lineas.push(`## ${escaparMarkdown(domData.nombre)}`);
      lineas.push("");

      for (const [tecId, tecData] of domData.tecnicas.entries()) {
        lineas.push(`### ${escaparMarkdown(tecData.nombre)} — ${tecId}`);
        for (const reg of tecData.reglas) {
          const enlaceMd = reg.url_fuente ? `[Ver regla](${reg.url_fuente})` : "Sin enlace";
          lineas.push(`- ${escaparMarkdown(reg.regla_nombre)} (${reg.regla_formato}) — ${enlaceMd}`);
        }
        lineas.push("");
      }
    }

    const contenidoMd = lineas.join("\n");
    const blob = new Blob([contenidoMd], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `umbra-radar-repertorio-${fechaHoy}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const cantidadSeleccionada = seleccionValida.size;
  const cantidadTotal = totalFavoritos;

  return (
    <main className="min-h-screen bg-umbra-bg text-umbra-ink p-6 sm:p-10 md:p-16">
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
            href="/dominios/dns"
            className="text-xs text-umbra-cyan hover:underline transition-colors hidden sm:inline-block"
          >
            Ir a Dominio DNS →
          </Link>
        </div>

        {/* Encabezado Principal */}
        <header className="mb-10 pb-8 border-b border-umbra-line flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 bg-umbra-cyan/10 border border-umbra-cyan/30 rounded-xl text-umbra-cyan">
                <Bookmark className="w-6 h-6 fill-umbra-cyan/20" />
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-umbra-ink">
                Repertorio de Detección
              </h1>
              <span className="text-xs font-semibold px-2.5 py-1 bg-amber-950/80 text-amber-400 border border-amber-800/60 rounded-full">
                {cantidadTotal} {cantidadTotal === 1 ? "regla guardada" : "reglas guardadas"}
              </span>
            </div>
            <p className="text-umbra-ink-dim max-w-3xl text-sm leading-relaxed">
              Catálogo personalizado de reglas SigmaHQ seleccionadas en tu investigación de seguridad.
              Guardadas localmente en tu navegador y listas para exportar a documentación Markdown.
            </p>
          </div>

          {/* Acciones Globales */}
          {cantidadTotal > 0 && (
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={exportarAMarkdown}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-umbra-cyan text-[#020305] font-semibold text-xs transition-all hover:bg-umbra-cyan/90 hover:shadow-lg hover:shadow-umbra-cyan/20 active:scale-95"
              >
                <Download className="w-4 h-4" />
                {cantidadSeleccionada > 0
                  ? `Exportar ${cantidadSeleccionada} seleccionadas (.md)`
                  : "Exportar todas (.md)"}
              </button>

              <button
                type="button"
                onClick={() => setMostrarConfirmLimpiar(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-rose-900/40 bg-rose-950/20 text-rose-400 text-xs font-medium hover:bg-rose-950/50 hover:border-rose-800/60 transition-colors"
                title="Limpiar todo el repertorio"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Limpiar todo</span>
              </button>
            </div>
          )}
        </header>

        {/* Modal de confirmación para vaciar el repertorio */}
        {mostrarConfirmLimpiar && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-umbra-surface border border-rose-900/60 p-6 rounded-2xl max-w-md w-full shadow-2xl">
              <h3 className="text-base font-bold text-umbra-ink mb-2">
                ¿Vaciar todo el repertorio?
              </h3>
              <p className="text-xs text-umbra-ink-dim mb-6 leading-relaxed">
                Esta acción eliminará todas las reglas guardadas en el almacenamiento de tu navegador.
                No se puede deshacer.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setMostrarConfirmLimpiar(false)}
                  className="px-4 py-2 rounded-xl text-xs text-umbra-ink-dim hover:text-umbra-ink border border-umbra-line transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    limpiarTodos();
                    setSeleccionados(new Set());
                    setMostrarConfirmLimpiar(false);
                  }}
                  className="px-4 py-2 rounded-xl text-xs bg-rose-600 hover:bg-rose-500 text-white font-semibold transition-colors"
                >
                  Confirmar y Vaciar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Barra de Selección Rápida */}
        {cantidadTotal > 0 && (
          <div className="bg-umbra-surface/50 border border-umbra-line rounded-xl px-4 py-3 mb-8 flex items-center justify-between flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleSeleccionarTodo}
                className="flex items-center gap-2 text-umbra-ink hover:text-umbra-cyan transition-colors"
              >
                {cantidadSeleccionada === cantidadTotal && cantidadTotal > 0 ? (
                  <CheckSquare className="w-4 h-4 text-umbra-cyan" />
                ) : cantidadSeleccionada > 0 ? (
                  <MinusSquare className="w-4 h-4 text-umbra-cyan" />
                ) : (
                  <Square className="w-4 h-4 text-umbra-ink-dim" />
                )}
                <span>
                  {cantidadSeleccionada === cantidadTotal
                    ? "Deseleccionar todas"
                    : "Seleccionar todas"}
                </span>
              </button>
              <span className="text-umbra-ink-muted">•</span>
              <span className="text-umbra-ink-dim">
                {cantidadSeleccionada} de {cantidadTotal} seleccionadas para exportar
              </span>
            </div>

            <span className="text-[11px] text-umbra-ink-muted">
              Jerarquía de exportación: Dominio → Técnica → Regla Sigma
            </span>
          </div>
        )}

        {/* Estado Vacío */}
        {cantidadTotal === 0 && (
          <div className="bg-umbra-surface border border-umbra-line rounded-2xl p-12 text-center max-w-2xl mx-auto my-8">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-umbra-cyan/10 border border-umbra-cyan/20 flex items-center justify-center text-umbra-cyan">
              <Bookmark className="w-8 h-8 opacity-60" />
            </div>
            <h2 className="text-xl font-bold text-umbra-ink mb-2">
              Tu repertorio está vacío
            </h2>
            <p className="text-sm text-umbra-ink-dim leading-relaxed mb-8 max-w-md mx-auto">
              Aún no has marcado ninguna regla de detección. Explora los vectores de infraestructura y haz clic en el icono de estrella (★) junto a cualquier regla SigmaHQ para guardarla aquí.
            </p>
            <Link
              href="/dominios"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-umbra-cyan text-[#020305] font-semibold text-xs hover:bg-umbra-cyan/90 transition-all hover:shadow-lg hover:shadow-umbra-cyan/20 active:scale-95"
            >
              Explorar Catálogo de Dominios
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {/* Listado Agrupado por Dominio y Técnica */}
        {cantidadTotal > 0 && (
          <div className="space-y-8">
            {agrupadoPorDominio.map((dominio) => {
              const todasReglasDominio = dominio.tecnicas.flatMap((t) => t.reglas);
              const cantReglasDominio = todasReglasDominio.filter((r) =>
                seleccionValida.has(r.key)
              ).length;
              const dominioCompletamenteSeleccionado =
                cantReglasDominio === todasReglasDominio.length && todasReglasDominio.length > 0;
              const dominioParcialmenteSeleccionado =
                cantReglasDominio > 0 && !dominioCompletamenteSeleccionado;

              return (
                <section
                  key={dominio.dominio_codigo}
                  className="bg-umbra-surface border border-umbra-line rounded-2xl p-6 transition-all"
                >
                  {/* Encabezado del Dominio */}
                  <div className="flex items-center justify-between pb-4 mb-6 border-b border-umbra-line">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => toggleSeleccionDominio(dominio)}
                        className="text-umbra-ink hover:text-umbra-cyan transition-colors"
                        title="Seleccionar todo el dominio"
                      >
                        {dominioCompletamenteSeleccionado ? (
                          <CheckSquare className="w-4 h-4 text-umbra-cyan" />
                        ) : dominioParcialmenteSeleccionado ? (
                          <MinusSquare className="w-4 h-4 text-umbra-cyan" />
                        ) : (
                          <Square className="w-4 h-4 text-umbra-ink-dim" />
                        )}
                      </button>
                      <div className="p-2 bg-umbra-cyan/10 text-umbra-cyan border border-umbra-cyan/20 rounded-lg">
                        <Globe className="w-4 h-4" />
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-umbra-ink">
                          Dominio: {dominio.dominio_nombre}
                        </h2>
                        <span className="text-[11px] text-umbra-ink-dim">
                          {todasReglasDominio.length} {todasReglasDominio.length === 1 ? "regla en este dominio" : "reglas en este dominio"}
                        </span>
                      </div>
                    </div>

                    <span className="font-mono text-xs text-umbra-cyan/80 bg-umbra-cyan/5 border border-umbra-cyan/20 px-2 py-0.5 rounded">
                      {dominio.dominio_codigo}
                    </span>
                  </div>

                  {/* Subgrupos por Técnica */}
                  <div className="space-y-6">
                    {dominio.tecnicas.map((tecnica) => {
                      const cantReglasTecnica = tecnica.reglas.filter((r) =>
                        seleccionValida.has(r.key)
                      ).length;
                      const tecnicaCompletamenteSeleccionada =
                        cantReglasTecnica === tecnica.reglas.length && tecnica.reglas.length > 0;
                      const tecnicaParcialmenteSeleccionada =
                        cantReglasTecnica > 0 && !tecnicaCompletamenteSeleccionada;

                      return (
                        <div
                          key={tecnica.tecnica_id}
                          className="bg-umbra-bg/50 border border-umbra-line/70 rounded-xl p-4 transition-all"
                        >
                          {/* Encabezado de la Técnica */}
                          <div className="flex items-center justify-between gap-3 mb-3.5 pb-2.5 border-b border-white/[0.04]">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <button
                                type="button"
                                onClick={() => toggleSeleccionTecnica(tecnica.reglas)}
                                className="text-umbra-ink hover:text-umbra-cyan transition-colors shrink-0"
                                title={
                                  tecnicaCompletamenteSeleccionada
                                    ? "Deseleccionar técnica completa"
                                    : "Seleccionar técnica completa"
                                }
                              >
                                {tecnicaCompletamenteSeleccionada ? (
                                  <CheckSquare className="w-3.5 h-3.5 text-umbra-cyan" />
                                ) : tecnicaParcialmenteSeleccionada ? (
                                  <MinusSquare className="w-3.5 h-3.5 text-umbra-cyan" />
                                ) : (
                                  <Square className="w-3.5 h-3.5 text-umbra-ink-dim" />
                                )}
                              </button>
                              <span className="font-mono text-xs font-bold text-umbra-cyan bg-umbra-cyan/10 border border-umbra-cyan/30 px-2 py-0.5 rounded shrink-0">
                                {tecnica.tecnica_id}
                              </span>
                              <h3 className="text-xs font-semibold text-umbra-ink truncate" title={tecnica.tecnica_nombre}>
                                {tecnica.tecnica_nombre}
                              </h3>
                            </div>

                            <span className="text-[11px] text-umbra-ink-dim shrink-0">
                              {tecnica.reglas.length} {tecnica.reglas.length === 1 ? "regla" : "reglas"}
                            </span>
                          </div>

                          {/* Listado de Reglas de esta Técnica */}
                          <ul className="space-y-2">
                            {tecnica.reglas.map((regla) => {
                              const estaSeleccionada = seleccionValida.has(regla.key);

                              return (
                                <li
                                  key={regla.key}
                                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2.5 rounded-lg border transition-all ${
                                    estaSeleccionada
                                      ? "bg-umbra-cyan/5 border-umbra-cyan/30"
                                      : "bg-umbra-surface/80 border-umbra-line hover:border-white/15"
                                  }`}
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <button
                                      type="button"
                                      onClick={() => toggleSeleccionRegla(regla.key)}
                                      className="text-umbra-ink hover:text-umbra-cyan transition-colors shrink-0"
                                    >
                                      {estaSeleccionada ? (
                                        <CheckSquare className="w-4 h-4 text-umbra-cyan" />
                                      ) : (
                                        <Square className="w-4 h-4 text-umbra-ink-dim" />
                                      )}
                                    </button>

                                    <span className="font-mono text-[10px] text-umbra-cyan bg-umbra-cyan/10 border border-umbra-cyan/30 px-1.5 py-0.5 rounded shrink-0">
                                      {regla.regla_formato}
                                    </span>

                                    <span
                                      className="text-xs text-umbra-ink font-medium leading-snug truncate"
                                      title={regla.regla_nombre}
                                    >
                                      {regla.regla_nombre}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                                    {regla.url_fuente && (
                                      <a
                                        href={regla.url_fuente}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[11px] text-umbra-cyan hover:underline inline-flex items-center gap-1 font-medium transition-colors"
                                      >
                                        Ver regla completa ↗
                                      </a>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => quitarFavorito(regla.regla_id, regla.tecnica_id)}
                                      className="p-1 rounded text-umbra-ink-muted hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                                      title="Quitar esta regla del repertorio"
                                      aria-label={`Quitar ${regla.regla_nombre} del repertorio`}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
