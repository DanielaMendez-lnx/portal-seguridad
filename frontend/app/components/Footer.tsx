"use client";

import React from "react";
import { usePathname } from "next/navigation";

export default function Footer() {
  const pathname = usePathname();

  // NOTA DE MANTENIMIENTO:
  // Los anchos máximos (max-w-*) y paddings horizontales están sincronizados manualmente
  // con el contenedor principal de cada página para garantizar alineación exacta en todos
  // los breakpoints. Si se modifica el layout o espaciado de alguna ruta, actualizar aquí:
  let containerClasses = "max-w-6xl px-6 sm:px-10 md:px-16"; // Fallback por defecto

  if (pathname === "/") {
    // Inicio: HeroRadar y tarjetas de características usan max-w-7xl px-6 sm:px-10
    containerClasses = "max-w-7xl px-6 sm:px-10";
  } else if (pathname === "/dominios") {
    // Catálogo de dominios: contenedor central max-w-5xl con p-8 md:p-16 en <main>
    containerClasses = "max-w-5xl px-8 md:px-16";
  } else if (pathname.startsWith("/dominios/")) {
    // Dashboards de dominio (ej. /dominios/dns): contenedor max-w-6xl con p-8 md:p-16 en <main>
    containerClasses = "max-w-6xl px-8 md:px-16";
  } else if (pathname === "/repertorio") {
    // Repertorio de reglas: contenedor max-w-6xl con p-6 sm:p-10 md:p-16 en <main>
    containerClasses = "max-w-6xl px-6 sm:px-10 md:px-16";
  }

  return (
    <footer className="border-t border-umbra-line bg-umbra-bg text-umbra-ink-dim py-10 text-xs mt-auto">
      <div className={`${containerClasses} mx-auto w-full flex flex-col gap-6`}>
        {/* Fila 1: Marca + Eslogan y Enlaces secundarios (variante en dos filas) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-umbra-line">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3.5">
            <div className="flex items-center gap-2 font-semibold text-sm tracking-tight text-umbra-ink">
              <div
                className="w-5 h-5 rounded-full border border-umbra-cyan relative flex items-center justify-center shrink-0"
                aria-hidden="true"
              >
                <div className="w-1 h-1 rounded-full bg-umbra-cyan shadow-[0_0_6px_var(--color-umbra-cyan)]" />
              </div>
              <span>Umbra Radar</span>
            </div>
            <span className="hidden sm:inline text-umbra-ink-muted">•</span>
            <p className="text-xs text-umbra-ink-dim">
              Open Threat Intelligence & Security Analytics Platform
            </p>
          </div>

          <div className="flex items-center gap-5 text-xs shrink-0">
            <a
              href="https://github.com/DanielaMendez-lnx/portal-seguridad/blob/main/NOTICE"
              target="_blank"
              rel="noopener noreferrer"
              className="text-umbra-ink-dim hover:text-umbra-ink hover:underline focus:outline-none focus:ring-2 focus:ring-umbra-cyan/50 rounded-sm transition-colors"
            >
              Avisos legales (NOTICE)
            </a>
            <a
              href="https://github.com/DanielaMendez-lnx/portal-seguridad"
              target="_blank"
              rel="noopener noreferrer"
              className="text-umbra-ink-dim hover:text-umbra-ink hover:underline focus:outline-none focus:ring-2 focus:ring-umbra-cyan/50 rounded-sm transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>

        {/* Fila 2: Copyright y Avisos Legales de Terceros */}
        <div className="space-y-2 max-w-4xl">
          <p className="text-umbra-ink font-medium">
            © 2026 Daniela Méndez ·{" "}
            <a
              href="https://github.com/DanielaMendez-lnx/portal-seguridad/blob/main/LICENSE"
              target="_blank"
              rel="noopener noreferrer"
              className="text-umbra-cyan hover:underline focus:outline-none focus:ring-2 focus:ring-umbra-cyan/50 rounded-sm transition-colors"
            >
              Licencia Apache 2.0
            </a>
          </p>

          <p className="text-[11px] text-umbra-ink-dim leading-relaxed">
            © 2026 The MITRE Corporation. This work is reproduced and distributed with the permission of The MITRE Corporation.{" "}
            <a
              href="https://attack.mitre.org/resources/legal-and-branding/terms-of-use/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-umbra-cyan hover:underline inline-flex items-center gap-0.5 focus:outline-none focus:ring-1 focus:ring-umbra-cyan/50 rounded-xs transition-colors"
            >
              Términos de uso ↗
            </a>
          </p>

          <p className="text-[11px] text-umbra-ink-dim leading-relaxed">
            This product uses the NVD API but is not endorsed or certified by the NVD.{" "}
            <a
              href="https://nvd.nist.gov/developers/terms-of-use"
              target="_blank"
              rel="noopener noreferrer"
              className="text-umbra-cyan hover:underline inline-flex items-center gap-0.5 focus:outline-none focus:ring-1 focus:ring-umbra-cyan/50 rounded-xs transition-colors"
            >
              Términos de la API ↗
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
