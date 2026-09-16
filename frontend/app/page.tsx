import Link from "next/link";
import { ShieldAlert, Database, Cpu, ArrowRight } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-8 md:p-16">
      {/* Barra superior */}
      <header className="max-w-6xl mx-auto w-full flex justify-between items-center pb-8 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600/20 border border-indigo-500/30 rounded-lg text-indigo-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <span className="text-xl font-bold tracking-tight">Threat Warehouse</span>
        </div>
        <div className="text-xs font-mono text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full">
          Live Intelligence Engine
        </div>
      </header>

      {/* Sección Hero */}
      <section className="max-w-4xl mx-auto w-full py-16 text-center flex flex-col items-center">
        <span className="text-xs font-semibold tracking-widest text-indigo-400 uppercase mb-4 px-3 py-1 bg-indigo-950/50 border border-indigo-800/50 rounded-full">
          Inteligencia de Amenazas Unificada
        </span>
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight">
          Monitoreo, Detección y Mitigación de Amenazas
        </h1>
        <p className="text-lg text-slate-400 max-w-2xl mb-10 leading-relaxed">
          Plataforma centralizada para correlacionar técnicas de ataque MITRE ATT&CK,
          controles de mitigación NIST SP 800-53, reglas Sigma y vulnerabilidades NVD en tiempo real.
        </p>

        <Link
          href="/dominios"
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-6 py-3.5 rounded-xl transition-all shadow-lg shadow-indigo-600/20 hover:scale-[1.02] active:scale-[0.98]"
        >
          Explorar Dominios
          <ArrowRight className="w-4 h-4" />
        </Link>
      </section>

      {/* Características del Warehouse */}
      <section className="max-w-6xl mx-auto w-full grid grid-cols-1 md:grid-cols-3 gap-6 pt-8">
        <div className="bg-slate-900/60 border border-slate-800/80 p-6 rounded-2xl">
          <div className="p-2.5 w-fit bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl mb-4">
            <Database className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Ingesta Continua</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            Pipelines automatizados vía GitHub Actions para sincronización diaria de CVEs y actualización periódica de frameworks de amenaza.
          </p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 p-6 rounded-2xl">
          <div className="p-2.5 w-fit bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-xl mb-4">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Mapeos Oficiales</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            Mitigaciones validadas por el Center for Threat-Informed Defense (CTID) cruzando técnicas con controles NIST SP 800-53 Rev. 5.
          </p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 p-6 rounded-2xl">
          <div className="p-2.5 w-fit bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded-xl mb-4">
            <Cpu className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Detección Práctica</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            Reglas de detección SigmaHQ listas para despliegue en SIEM/XDR según la telemetría del entorno monitoreado.
          </p>
        </div>
      </section>

      {/* Pie de página */}
      <footer className="max-w-6xl mx-auto w-full pt-16 text-center text-xs text-slate-400">
        Threat Intelligence & Security Analytics Architecture
      </footer>
    </main>
  );
}