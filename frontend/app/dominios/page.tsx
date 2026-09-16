
import Link from "next/link";
import { Globe, Shield, Key, ArrowRight, ArrowLeft } from "lucide-react";

export default function DominiosCatalogPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-8 md:p-16">
      <div className="max-w-5xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al Inicio
        </Link>

        <header className="mb-10">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-2">
            Catálogo de Dominios
          </h1>
          <p className="text-slate-400">
            Selecciona un vector de infraestructura para inspeccionar su postura de seguridad, técnicas asociadas y vulnerabilidades.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Tarjeta DNS (Activa) */}
          <Link
            href="/dominios/dns"
            className="group relative bg-slate-900 border border-slate-800 hover:border-indigo-500/50 p-6 rounded-2xl transition-all hover:shadow-xl hover:shadow-indigo-500/10 flex flex-col justify-between"
          >
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-xl">
                  <Globe className="w-6 h-6" />
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-950 text-emerald-400 border border-emerald-800/60 rounded-full">
                  Activo
                </span>
              </div>
              <h2 className="text-xl font-bold mb-2 group-hover:text-indigo-400 transition-colors">
                Dominio DNS
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed mb-6">
                Resolución de nombres, infraestructura de resolvers, envenenamiento de caché, túneles DNS y mitigaciones clave.
              </p>
            </div>

            <div className="flex items-center text-sm font-medium text-indigo-400 gap-1.5 group-hover:translate-x-1 transition-transform">
              Entrar al Dashboard
              <ArrowRight className="w-4 h-4" />
            </div>
          </Link>

          {/* Tarjeta Cloud IAM (Placeholder) */}
          <div className="bg-slate-900/40 border border-slate-800/50 p-6 rounded-2xl opacity-60 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-slate-800 text-slate-400 rounded-xl">
                  <Key className="w-6 h-6" />
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 bg-slate-800 text-slate-400 rounded-full">
                  Próximamente
                </span>
              </div>
              <h2 className="text-xl font-bold mb-2">Identidad & Cloud IAM</h2>
              <p className="text-sm text-slate-400 leading-relaxed mb-6">
                Escalamiento de privilegios en nubes públicas, abuso de roles asumidos y tokens de sesión.
              </p>
            </div>
            <span className="text-xs text-slate-400">En desarrollo</span>
          </div>
        </div>
      </div>
    </main>
  );
}
