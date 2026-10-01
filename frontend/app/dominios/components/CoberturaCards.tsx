"use client";

import { Activity, ShieldCheck, ShieldAlert, AlertTriangle } from "lucide-react";

export interface CoberturaResumen {
  total_tecnicas: number;
  tecnicas_con_controles: number;
  tecnicas_sin_controles: number;
  porcentaje_con_controles: number;
  total_reglas_unicas: number;
}

interface Props {
  resumen: CoberturaResumen;
  totalCves?: number;
}

export default function CoberturaCards({ resumen, totalCves }: Props) {
  if (!resumen || resumen.total_tecnicas === 0) {
    return null;
  }

  return (
    <div className={`grid grid-cols-1 ${totalCves !== undefined ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-3"} gap-6 mb-10`}>
      {/* 1. Total de Técnicas ATT&CK */}
      <div className="bg-white/[0.02] border border-white/[0.07] hover:border-white/15 p-6 rounded-2xl transition-colors">
        <div className="p-2.5 w-fit bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl mb-4">
          <Activity className="w-5 h-5" />
        </div>
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-3xl font-extrabold text-[#f2f5fa] tracking-tight">
            {resumen.total_tecnicas}
          </span>
          <span className="text-xs uppercase tracking-wider font-semibold text-emerald-400">
            Técnicas ATT&CK
          </span>
        </div>
        <h3 className="text-sm font-semibold text-[#f2f5fa] mb-1">Alcance del Dominio</h3>
        <p className="text-xs text-[#8b95ac] leading-relaxed">
          Técnicas insignia de comportamiento adversarial evaluadas y catalogadas en este vector.
        </p>
      </div>

      {/* 2. % con Mapeo NIST SP 800-53 */}
      <div className="bg-white/[0.02] border border-white/[0.07] hover:border-white/15 p-6 rounded-2xl transition-colors">
        <div className="p-2.5 w-fit bg-[#4fd8ff]/10 text-[#4fd8ff] border border-[#4fd8ff]/20 rounded-xl mb-4">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-3xl font-extrabold text-[#f2f5fa] tracking-tight">
            {resumen.porcentaje_con_controles}%
          </span>
          <span className="text-xs uppercase tracking-wider font-semibold text-[#4fd8ff]">
            Mapeo NIST Oficial
          </span>
        </div>
        <h3 className="text-sm font-semibold text-[#f2f5fa] mb-1">Controles SP 800-53</h3>
        <p className="text-xs text-[#8b95ac] leading-relaxed">
          {resumen.tecnicas_con_controles} de {resumen.total_tecnicas} técnicas cuentan con controles directos en CTID ({resumen.tecnicas_sin_controles} sin mapeo directo en el marco).
        </p>
      </div>

      {/* 3. Reglas de Detección Sigma */}
      <div className="bg-white/[0.02] border border-white/[0.07] hover:border-white/15 p-6 rounded-2xl transition-colors">
        <div className="p-2.5 w-fit bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded-xl mb-4">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-3xl font-extrabold text-[#f2f5fa] tracking-tight">
            {resumen.total_reglas_unicas}
          </span>
          <span className="text-xs uppercase tracking-wider font-semibold text-violet-400">
            Reglas Sigma
          </span>
        </div>
        <h3 className="text-sm font-semibold text-[#f2f5fa] mb-1">Firmas de Detección</h3>
        <p className="text-xs text-[#8b95ac] leading-relaxed">
          Reglas de la comunidad SigmaHQ vinculadas a los vectores de ataque de este dominio para SIEM y EDR.
        </p>
      </div>

      {/* 4. Total de CVEs NVD (Opcional, para dominios con vulnerabilidades) */}
      {totalCves !== undefined && (
        <div className="bg-white/[0.02] border border-white/[0.07] hover:border-white/15 p-6 rounded-2xl transition-colors">
          <div className="p-2.5 w-fit bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl mb-4">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-3xl font-extrabold text-[#f2f5fa] tracking-tight">
              {totalCves}
            </span>
            <span className="text-xs uppercase tracking-wider font-semibold text-amber-400">
              Vulnerabilidades NVD
            </span>
          </div>
          <h3 className="text-sm font-semibold text-[#f2f5fa] mb-1">CVEs Correlacionados</h3>
          <p className="text-xs text-[#8b95ac] leading-relaxed">
            Vulnerabilidades rastreadas en los últimos 120 días asociadas a protocolos e identidades de este dominio.
          </p>
        </div>
      )}
    </div>
  );
}
