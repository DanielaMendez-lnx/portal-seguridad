"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export interface TecnicaCoberturaItem {
  tecnica_id: string;
  tecnica_nombre: string;
  total_reglas: number;
  tiene_controles: boolean;
}

interface Props {
  tecnicas: TecnicaCoberturaItem[];
  dominioNombre?: string;
}

export default function GraficoReglasPorTecnica({
  tecnicas,
  dominioNombre = "este dominio",
}: Props) {
  const [mostrarTodas, setMostrarTodas] = useState(false);

  // No renderizar si no hay técnicas o si ninguna técnica tiene reglas vinculadas
  if (!tecnicas || tecnicas.length === 0 || tecnicas.every((t) => t.total_reglas === 0)) {
    return null;
  }

  // Filtrar y ordenar técnicas con al menos 1 regla o mostrar según toggle
  const tecnicasConReglas = tecnicas.filter((t) => t.total_reglas > 0);
  const tecnicasParaMostrar = mostrarTodas
    ? tecnicasConReglas
    : tecnicasConReglas.slice(0, 10);

  // Formatear datos para el gráfico horizontal
  // Invertir orden para que la técnica con más reglas aparezca en la parte superior del gráfico vertical
  const chartData = [...tecnicasParaMostrar].reverse().map((t) => ({
    tecnica_id: t.tecnica_id,
    tecnica_nombre: t.tecnica_nombre,
    etiquetaCorta: `${t.tecnica_id} · ${
      t.tecnica_nombre.length > 22
        ? `${t.tecnica_nombre.slice(0, 20)}...`
        : t.tecnica_nombre
    }`,
    total_reglas: t.total_reglas,
    tiene_controles: t.tiene_controles,
  }));

  const alturaDinamica = Math.max(340, chartData.length * 36);

  return (
    <div className="bg-umbra-surface border border-umbra-line rounded-2xl p-6 mb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-bold text-umbra-ink">
              Reglas de Detección por Técnica
            </h2>
            <a
              href="https://github.com/SigmaHQ/sigma"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-mono text-umbra-cyan/80 hover:text-umbra-cyan hover:underline transition-colors"
            >
              Fuente: SigmaHQ ↗
            </a>
          </div>
          <p className="text-xs text-umbra-ink-dim mt-0.5">
            Densidad de firmas de detección de la comunidad SigmaHQ vinculadas a los vectores de {dominioNombre}.
          </p>
        </div>

        {/* Toggle para alternar entre Top 10 y vista completa */}
        {tecnicasConReglas.length > 10 && (
          <div className="flex items-center gap-1.5 bg-umbra-bg p-1 rounded-xl border border-umbra-line shrink-0">
            <button
              type="button"
              onClick={() => setMostrarTodas(false)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                !mostrarTodas
                  ? "bg-umbra-cyan/15 text-umbra-cyan border border-umbra-cyan/30 shadow-sm"
                  : "text-umbra-ink-dim hover:text-umbra-ink"
              }`}
            >
              Top 10
            </button>
            <button
              type="button"
              onClick={() => setMostrarTodas(true)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                mostrarTodas
                  ? "bg-umbra-cyan/15 text-umbra-cyan border border-umbra-cyan/30 shadow-sm"
                  : "text-umbra-ink-dim hover:text-umbra-ink"
              }`}
            >
              Ver todas ({tecnicasConReglas.length})
            </button>
          </div>
        )}
      </div>

      <div style={{ height: `${alturaDinamica}px` }} className="w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={chartData}
            margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255, 255, 255, 0.07)"
              horizontal={false}
            />
            <XAxis
              type="number"
              stroke="#8b95ac"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="etiquetaCorta"
              stroke="#8b95ac"
              fontSize={11}
              width={180}
              tickLine={false}
              axisLine={false}
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
              formatter={(value: unknown) => [
                `${value ?? 0} reglas de detección`,
                "Reglas Sigma",
              ]}
              labelFormatter={(_, payload) => {
                const item = payload && payload[0]?.payload;
                if (!item) return "";
                const estadoNist = item.tiene_controles
                  ? "✓ Controles NIST SP 800-53 asociados"
                  : "○ Sin mapeo directo disponible en CTID";
                return `${item.tecnica_id}: ${item.tecnica_nombre}\n(${estadoNist})`;
              }}
            />
            <Bar
              dataKey="total_reglas"
              fill="#4fd8ff"
              radius={[0, 4, 4, 0]}
              maxBarSize={22}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
