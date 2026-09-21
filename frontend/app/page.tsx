import { Database, ShieldAlert, Cpu } from "lucide-react";
import HeroRadar from "./HeroRadar";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#020305] text-[#f2f5fa] flex flex-col justify-between">
      {/* Hero Principal con Radar Animado y Navegación */}
      <HeroRadar />

      {/* Características del Motor de Inteligencia */}
      <section className="relative z-10 max-w-7xl mx-auto w-full px-6 sm:px-10 py-16">
        <div className="border-t border-white/[0.06] pt-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white/[0.02] border border-white/[0.07] hover:border-white/15 p-6 rounded-2xl transition-colors">
              <div className="p-2.5 w-fit bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl mb-4">
                <Database className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-semibold mb-2 text-[#f2f5fa]">Datos actualizados</h2>
              <p className="text-sm text-[#8b95ac] leading-relaxed">
                Pipelines automatizados para sincronización diaria de CVEs y actualización periódica de frameworks de amenaza.
              </p>
            </div>

            <div className="bg-white/[0.02] border border-white/[0.07] hover:border-white/15 p-6 rounded-2xl transition-colors">
              <div className="p-2.5 w-fit bg-[#4fd8ff]/10 text-[#4fd8ff] border border-[#4fd8ff]/20 rounded-xl mb-4">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-semibold mb-2 text-[#f2f5fa]">Mapeo a normas</h2>
              <p className="text-sm text-[#8b95ac] leading-relaxed">
                Técnicas conectadas a controles NIST SP 800-53 con los mapeos disponibles y la fuente siempre visible.
              </p>
            </div>

            <div className="bg-white/[0.02] border border-white/[0.07] hover:border-white/15 p-6 rounded-2xl transition-colors">
              <div className="p-2.5 w-fit bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded-xl mb-4">
                <Cpu className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-semibold mb-2 text-[#f2f5fa]">Reglas de referencia</h2>
              <p className="text-sm text-[#8b95ac] leading-relaxed">
                Reglas de SigmaHQ asociadas a cada técnica, como punto de partida — revísalas antes de desplegarlas.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pie de página */}
      <footer className="relative z-10 max-w-7xl mx-auto w-full px-6 sm:px-10 py-10 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#8b95ac]">
        <span>Umbra Radar — Threat Intelligence & Security Analytics Platform</span>
        <span>MITRE ATT&CK • NIST SP 800-53 • NVD • CISA • SigmaHQ</span>
      </footer>
    </main>
  );
}