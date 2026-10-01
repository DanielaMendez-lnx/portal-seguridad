export const dynamic = "force-dynamic";
export const maxDuration = 60; // Límite en Vercel Hobby (60s)

import Link from "next/link";
import { ArrowLeft, Key } from "lucide-react";
import CoberturaCards, { CoberturaResumen } from "../components/CoberturaCards";
import GraficoReglasPorTecnica, { TecnicaCoberturaItem } from "../components/GraficoReglasPorTecnica";
import SeccionTecnicas, { Tecnica } from "../dns/SeccionTecnicas";
import GraficoSeveridad from "../dns/GraficoSeveridad";
import GraficoTendenciaCVEs, { TendenciaMes } from "../dns/GraficoTendenciaCVEs";
import SeccionVulnerabilidades, { Vulnerabilidad } from "../dns/SeccionVulnerabilidades";

interface CoberturaResponse {
  dominio_id: number;
  dominio_nombre: string;
  dominio_slug: string;
  resumen: CoberturaResumen;
  tecnicas: TecnicaCoberturaItem[];
}

interface VulnerabilidadesResponse {
  total: number;
  limit: number;
  offset: number;
  items: Vulnerabilidad[];
}

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

async function fetchWithTimeout(url: string, timeoutMs = 45000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new DOMException("Timeout de conexión con el backend", "TimeoutError"));
  }, timeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    return res;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function getTecnicas(): Promise<Tecnica[]> {
  const res = await fetchWithTimeout(`${API_BASE}/dominios/iam/tecnicas`);
  if (!res.ok) {
    throw new Error(`Error al obtener técnicas de IAM (${res.status})`);
  }
  return await res.json();
}

async function getCobertura(): Promise<CoberturaResponse> {
  const res = await fetchWithTimeout(`${API_BASE}/dominios/iam/cobertura`);
  if (!res.ok) {
    throw new Error(`Error al obtener cobertura de IAM (${res.status})`);
  }
  return await res.json();
}

async function getVulnerabilidades(): Promise<VulnerabilidadesResponse> {
  const res = await fetchWithTimeout(`${API_BASE}/dominios/iam/vulnerabilidades`);
  if (!res.ok) {
    throw new Error(`Error al obtener vulnerabilidades de IAM (${res.status})`);
  }
  return await res.json();
}

async function getTendenciaInicial(): Promise<TendenciaMes[]> {
  const res = await fetchWithTimeout(`${API_BASE}/dominios/iam/vulnerabilidades/tendencia?rango=6m`);
  if (!res.ok) {
    throw new Error(`Error al obtener tendencia de IAM (${res.status})`);
  }
  return await res.json();
}

export default async function IamDashboardPage() {
  // Carga concurrente resiliente con Promise.allSettled
  const [tecnicasRes, coberturaRes, cvesRes, tendenciaRes] = await Promise.allSettled([
    getTecnicas(),
    getCobertura(),
    getVulnerabilidades(),
    getTendenciaInicial(),
  ]);

  // Si fallan las técnicas MITRE (crítico), relanzamos para error.tsx
  if (tecnicasRes.status === "rejected") {
    throw tecnicasRes.reason;
  }

  const tecnicas = tecnicasRes.value;

  const cobertura: CoberturaResponse =
    coberturaRes.status === "fulfilled"
      ? coberturaRes.value
      : {
          dominio_id: 21,
          dominio_nombre: "Identity & Access Management (IAM)",
          dominio_slug: "iam",
          resumen: {
            total_tecnicas: tecnicas.length,
            tecnicas_con_controles: 0,
            tecnicas_sin_controles: tecnicas.length,
            porcentaje_con_controles: 0,
            total_reglas_unicas: 0,
          },
          tecnicas: [],
        };

  const cvesData: VulnerabilidadesResponse =
    cvesRes.status === "fulfilled"
      ? cvesRes.value
      : { total: 0, limit: 40, offset: 0, items: [] };

  const tendenciaInicial: TendenciaMes[] =
    tendenciaRes.status === "fulfilled"
      ? tendenciaRes.value
      : [];

  const cves = cvesData.items;
  const totalCves = cvesData.total;

  return (
    <main className="min-h-screen bg-umbra-bg text-umbra-ink p-8 md:p-16">
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
            href="/repertorio"
            className="inline-flex items-center gap-1.5 text-xs text-umbra-cyan hover:underline transition-colors font-medium"
          >
            Ver Repertorio de Reglas →
          </Link>
        </div>

        {/* Encabezado del Dominio */}
        <header className="mb-10 pb-8 border-b border-umbra-line">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <div className="p-2 bg-umbra-cyan/10 text-umbra-cyan border border-umbra-cyan/30 rounded-lg">
              <Key className="w-5 h-5" />
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-umbra-ink">
              Dominio: Identity & Access Management (IAM)
            </h1>
            <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-950 text-emerald-400 border border-emerald-800/60 rounded-full">
              En Producción
            </span>
          </div>
          <p className="text-umbra-ink-dim max-w-3xl text-sm leading-relaxed">
            Superficie de autenticación, directorio activo, federación de identidades y gestión de accesos privilegiados. Correlación analítica entre técnicas de ataque MITRE ATT&CK, marcos de mitigación NIST SP 800-53, reglas de detección comunitaria SigmaHQ y vulnerabilidades NVD.
          </p>
        </header>

        {/* 1. Cobertura de Seguridad: 4 tarjetas KPI integradas */}
        <CoberturaCards resumen={cobertura.resumen} totalCves={totalCves} />

        {/* 2. Analítica de Detección: Reglas SigmaHQ por Técnica ATT&CK */}
        <GraficoReglasPorTecnica
          tecnicas={cobertura.tecnicas}
          dominioNombre="Identity & Access Management (IAM)"
        />

        {/* 3. Matriz interactiva MITRE ATT&CK + NIST SP 800-53 + SigmaHQ */}
        <SeccionTecnicas
          tecnicas={tecnicas}
          dominioCodigo="IAM"
          dominioNombre="Identity & Access Management (IAM)"
        />

        {/* 4. Analítica de Vulnerabilidades: Severidad CVSS y Tendencia Temporal */}
        <GraficoSeveridad cves={cves} />

        <GraficoTendenciaCVEs
          apiBase={API_BASE}
          initialData={tendenciaInicial}
          dominioSlug="iam"
          titulo="CVEs de IAM Divulgados por Mes"
          descripcionFuente="Frecuencia de vulnerabilidades en protocolos de autenticación, servicios de directorio y control de acceso (Active Directory, Kerberos, LDAP, NTLM, SAML) publicadas formalmente en NVD según su fecha oficial de divulgación."
        />

        {/* 5. Tabla de Vulnerabilidades NVD Paginada y Expandible */}
        <SeccionVulnerabilidades
          initialCves={cves}
          total={totalCves}
          apiBase={API_BASE}
          dominioSlug="iam"
          titulo="Vulnerabilidades de IAM Recientes (NVD)"
        />
      </div>
    </main>
  );
}
