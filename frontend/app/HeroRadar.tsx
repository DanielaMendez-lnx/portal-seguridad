import Link from "next/link";
import styles from "./HeroRadar.module.css";

export default function HeroRadar() {
  return (
    <div className="relative overflow-hidden bg-[#020305] text-[#f2f5fa] min-h-[92vh] flex flex-col justify-between">
      {/* Escenario de fondo del Radar animado */}
      <div className={styles.radarStage} aria-hidden="true">
        <div className={`${styles.radarRing} ${styles.ring1}`} />
        <div className={`${styles.radarRing} ${styles.ring2}`} />
        <div className={`${styles.radarRing} ${styles.ring3}`} />
        <div className={`${styles.radarRing} ${styles.ring4}`} />
        <div className={styles.radarCross} />
        <div className={`${styles.radarCross} ${styles.crossVert}`} />
        <div className={styles.radarSweep} />
        <div className={`${styles.blip} ${styles.blip1}`} />
        <div className={`${styles.blip} ${styles.blip2}`} />
        <div className={`${styles.blip} ${styles.blip3}`} />
        <div className={`${styles.blip} ${styles.blip4}`} />
        <div className={`${styles.blip} ${styles.blip5}`} />
      </div>

      {/* Difuminado radial para fundir el radar con el fondo */}
      <div className={styles.radarFade} aria-hidden="true" />

      {/* Contenedor principal de contenido */}
      <div className="relative z-10 max-w-7xl mx-auto w-full px-6 sm:px-10 flex flex-col min-h-full">
        {/* Barra de Navegación superior */}
        <nav
          className="flex items-center justify-between py-8 border-b border-white/[0.06]"
          aria-label="Navegación principal"
        >
          <div className="flex items-center gap-3 font-semibold text-base tracking-tight text-[#f2f5fa]">
            <div
              className="w-7 h-7 rounded-full border-[1.5px] border-[#4fd8ff] relative flex items-center justify-center"
              aria-hidden="true"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-[#4fd8ff] shadow-[0_0_8px_#4fd8ff]" />
            </div>
            <span>Umbra Radar</span>
          </div>

          <div className="flex items-center gap-8">
            <Link
              href="/dominios"
              className="text-[#8b95ac] hover:text-[#f2f5fa] text-[14.5px] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#4fd8ff]/50 rounded-md px-1"
            >
              Dominios
            </Link>
            <a
              href="https://github.com/DanielaMendez-lnx/portal-seguridad"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#8b95ac] hover:text-[#f2f5fa] text-[14.5px] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#4fd8ff]/50 rounded-md px-1"
            >
              GitHub
            </a>
          </div>
        </nav>

        {/* Sección Hero */}
        <section className="flex-1 flex flex-col items-center justify-center text-center py-16 sm:py-24">
          {/* Eyebrow con indicador táctico */}
          <div className="inline-flex items-center gap-2.5 font-mono text-xs tracking-wider text-[#4fd8ff] bg-[#4fd8ff]/[0.06] border border-[#4fd8ff]/[0.22] px-4 py-1.5 rounded-full mb-8">
            <span className={styles.eyebrowPing} aria-hidden="true" />
            <span>Portal abierto de inteligencia de amenazas</span>
          </div>

          {/* Titular Principal */}
          <h1 className="font-bold tracking-tight leading-[0.98] text-5xl sm:text-7xl lg:text-[100px] xl:text-[112px]">
            <span className="text-[#f2f5fa]">Umbra</span>{" "}
            <span className="bg-gradient-to-r from-[#4fd8ff] via-[#3d7bff] to-[#3d7bff] bg-clip-text text-transparent">
              Radar
            </span>
          </h1>

          {/* Subtítulo Descriptivo */}
          <p className="mt-7 max-w-2xl text-[16px] sm:text-[17px] leading-relaxed text-[#8b95ac] font-normal">
            Explora técnicas de ataque por dominio y descubre qué controles normativos y reglas de
            detección se alinean con cada una — con la confianza de cada dato siempre visible, sin
            tener que revisar sitio por sitio.
          </p>

          {/* Botones de Acción (CTA) */}
          <div className="mt-9 flex flex-wrap justify-center gap-3.5">
            <Link
              href="/dominios"
              className="bg-[#f2f5fa] hover:bg-white text-[#050608] font-semibold text-[14.5px] px-6 py-3 rounded-lg transition-transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-[#4fd8ff]/10 focus:outline-none focus:ring-2 focus:ring-[#4fd8ff]"
            >
              Explorar dominios
            </Link>
            <a
              href="https://github.com/DanielaMendez-lnx/portal-seguridad"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-transparent hover:bg-white/[0.04] text-[#f2f5fa] border border-white/10 hover:border-white/20 font-medium text-[14.5px] px-5 py-3 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-[#4fd8ff]"
            >
              Ver en GitHub
            </a>
          </div>

          {/* Fila de Fuentes Consumidas */}
          <div className="mt-14 flex flex-col items-center gap-4">
            <span className="font-mono text-[11px] tracking-[0.08em] text-[#4d5568] uppercase">
              Fuentes consumidas actualmente
            </span>
            <div className="flex flex-wrap justify-center gap-2.5 max-w-3xl">
              <div className="inline-flex items-center gap-2 font-mono text-[12.5px] text-[#8b95ac] bg-white/[0.02] border border-white/[0.07] px-3.5 py-2 rounded-lg">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4fd8ff]" aria-hidden="true" />
                <span>MITRE ATT&CK</span>
              </div>
              <div className="inline-flex items-center gap-2 font-mono text-[12.5px] text-[#8b95ac] bg-white/[0.02] border border-white/[0.07] px-3.5 py-2 rounded-lg">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3d7bff]" aria-hidden="true" />
                <span>NIST SP 800-53</span>
              </div>
              <div className="inline-flex items-center gap-2 font-mono text-[12.5px] text-[#8b95ac] bg-white/[0.02] border border-white/[0.07] px-3.5 py-2 rounded-lg">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4fd8ff]" aria-hidden="true" />
                <span>NVD / CVE</span>
              </div>
              <div className="inline-flex items-center gap-2 font-mono text-[12.5px] text-[#8b95ac] bg-white/[0.02] border border-white/[0.07] px-3.5 py-2 rounded-lg">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3d7bff]" aria-hidden="true" />
                <span>CISA Advisories</span>
              </div>
              <div className="inline-flex items-center gap-2 font-mono text-[12.5px] text-[#8b95ac] bg-white/[0.02] border border-white/[0.07] px-3.5 py-2 rounded-lg">
                <span className="w-1.5 h-1.5 rounded-full bg-[#8b95ac]" aria-hidden="true" />
                <span>SigmaHQ</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
