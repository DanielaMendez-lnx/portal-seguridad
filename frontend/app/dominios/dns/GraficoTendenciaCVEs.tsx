"use client";

import { useState, useEffect, useRef } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import LoadingRadar from "@/app/components/radar/LoadingRadar";

export interface TendenciaMes {
  mes: string;
  total: number;
}

interface Props {
  apiBase: string;
  initialData?: TendenciaMes[];
}

export default function GraficoTendenciaCVEs({ apiBase, initialData = [] }: Props) {
  const [rango, setRango] = useState<"6m" | "1y">("6m");
  const [datos, setDatos] = useState<TendenciaMes[]>(initialData);
  const [cargando, setCargando] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const yaCargoInicial = useRef(initialData.length > 0);

  const cargarTendencia = async (rangoTarget = rango) => {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/dominios/DNS/vulnerabilidades/tendencia?rango=${rangoTarget}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Error al obtener tendencia de vulnerabilidades");
      const data: TendenciaMes[] = await res.json();
      setDatos(data);
    } catch (err) {
      console.error("[Tendencia Error]:", err);
      setError("No se pudo obtener la tendencia temporal.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    // Si ya tenemos datos iniciales de SSR en 6m, omitimos la primera llamada redundante
    if (rango === "6m" && yaCargoInicial.current) {
      yaCargoInicial.current = false;
      return;
    }

    cargarTendencia(rango);
  }, [rango, apiBase]);

  const formatearMes = (mesStr: string) => {
    const parts = mesStr.split("-");
    if (parts.length !== 2) return mesStr;
    const [y, m] = parts;
    const nombres = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const idx = parseInt(m, 10) - 1;
    return `${nombres[idx] || m} '${y.slice(2)}`;
  };

  const chartData = datos.map((d) => ({
    mesOriginal: d.mes,
    mesFormateado: formatearMes(d.mes),
    total: d.total,
  }));

  return (
    <div className="bg-umbra-surface border border-umbra-line rounded-2xl p-6 mb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-bold text-umbra-ink">CVEs de Red Divulgados por Mes</h2>
            <a
              href="https://nvd.nist.gov/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-mono text-umbra-cyan/80 hover:text-umbra-cyan hover:underline transition-colors"
            >
              Fuente: NVD ↗
            </a>
          </div>
          <p className="text-xs text-umbra-ink-dim mt-0.5">
            Frecuencia de vulnerabilidades de infraestructura y protocolos de red (DNS, SMB, FTP, servicios L2/L3) publicadas formalmente en NVD según su fecha oficial de divulgación.
          </p>
        </div>

        {/* Selector de rango temporal */}
        <div className="flex items-center gap-1.5 bg-umbra-bg p-1 rounded-xl border border-umbra-line shrink-0">
          <button
            type="button"
            onClick={() => setRango("6m")}
            disabled={cargando}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              rango === "6m"
                ? "bg-umbra-cyan/15 text-umbra-cyan border border-umbra-cyan/30 shadow-sm"
                : "text-umbra-ink-dim hover:text-umbra-ink"
            }`}
          >
            6 Meses
          </button>
          <button
            type="button"
            onClick={() => setRango("1y")}
            disabled={cargando}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              rango === "1y"
                ? "bg-umbra-cyan/15 text-umbra-cyan border border-umbra-cyan/30 shadow-sm"
                : "text-umbra-ink-dim hover:text-umbra-ink"
            }`}
          >
            1 Año
          </button>
        </div>
      </div>

      <div className="h-64 w-full relative">
        {(cargando || error) && (
          <div className="absolute inset-0 bg-umbra-surface/85 backdrop-blur-xs flex items-center justify-center z-10 rounded-xl">
            <LoadingRadar
              variant="compact"
              error={error}
              onRetry={() => cargarTendencia(rango)}
            />
          </div>
        )}

        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.07)" vertical={false} />
            <XAxis
              dataKey="mesFormateado"
              stroke="#8b95ac"
              fontSize={10}
              interval={0}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#8b95ac"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#070a10",
                borderColor: "rgba(79, 216, 255, 0.2)",
                borderRadius: "0.75rem",
                color: "#f2f5fa",
                fontSize: "12px",
                boxShadow: "0 8px 24px rgba(0, 0, 0, 0.5)",
              }}
              cursor={{ fill: "rgba(79, 216, 255, 0.06)" }}
              formatter={(value: unknown) => [`${value ?? 0} CVEs divulgados`, "Publicaciones"]}
              labelFormatter={(_, payload) => {
                const item = payload && payload[0]?.payload;
                return item ? `Mes oficial: ${item.mesOriginal}` : "";
              }}
            />
            <Bar
              dataKey="total"
              fill="#4fd8ff"
              radius={[6, 6, 0, 0]}
              maxBarSize={48}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
