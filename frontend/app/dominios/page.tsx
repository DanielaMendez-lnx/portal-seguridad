
import Link from "next/link";
import { Globe, Key, ArrowRight, ArrowLeft } from "lucide-react";

export default function DominiosCatalogPage() {
  return (
    <main className="min-h-screen bg-umbra-bg text-umbra-ink p-8 md:p-16">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-umbra-ink-dim hover:text-umbra-ink transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al Inicio
          </Link>
          <Link
            href="/repertorio"
            className="inline-flex items-center gap-1.5 text-xs text-umbra-cyan hover:underline transition-colors font-medium"
          >
            Ver Repertorio de Reglas →
          </Link>
        </div>

        <header className="mb-10">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-umbra-ink mb-2">
            Catálogo de Dominios
          </h1>
          <p className="text-umbra-ink-dim">
            Selecciona un vector de infraestructura para inspeccionar su postura de seguridad, técnicas asociadas y vulnerabilidades.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Tarjeta DNS (Activa) */}
          <Link
            href="/dominios/dns"
            className="group relative bg-umbra-surface border border-umbra-line hover:border-umbra-cyan/50 p-6 rounded-2xl transition-all hover:shadow-xl hover:shadow-umbra-cyan/10 flex flex-col justify-between"
          >
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-umbra-cyan/10 text-umbra-cyan border border-umbra-cyan/30 rounded-xl">
                  <Globe className="w-6 h-6" />
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-950 text-emerald-400 border border-emerald-800/60 rounded-full">
                  Activo
                </span>
              </div>
              <h2 className="text-xl font-bold mb-2 text-umbra-ink group-hover:text-umbra-cyan transition-colors">
                Dominio DNS
              </h2>
              <p className="text-sm text-umbra-ink-dim leading-relaxed mb-6">
                Resolución de nombres, infraestructura de resolvers, envenenamiento de caché, túneles DNS y mitigaciones clave.
              </p>
            </div>

            <div className="flex items-center text-sm font-medium text-umbra-cyan gap-1.5 group-hover:translate-x-1 transition-transform">
              Entrar al Dashboard
              <ArrowRight className="w-4 h-4" />
            </div>
          </Link>

          {/* Tarjeta Cloud IAM (Placeholder) */}
          <div className="bg-umbra-surface/40 border border-umbra-line p-6 rounded-2xl opacity-60 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-umbra-surface text-umbra-ink-muted border border-umbra-line rounded-xl">
                  <Key className="w-6 h-6" />
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 bg-umbra-surface text-umbra-ink-muted border border-umbra-line rounded-full">
                  Próximamente
                </span>
              </div>
              <h2 className="text-xl font-bold mb-2 text-umbra-ink">Identidad & Cloud IAM</h2>
              <p className="text-sm text-umbra-ink-dim leading-relaxed mb-6">
                Escalamiento de privilegios en nubes públicas, abuso de roles asumidos y tokens de sesión.
              </p>
            </div>
            <span className="text-xs text-umbra-ink-muted">En desarrollo</span>
          </div>
        </div>
      </div>
    </main>
  );
}
