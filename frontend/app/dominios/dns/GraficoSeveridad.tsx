
"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";

interface Vulnerabilidad {
  id: string;
  cvss_severity: string | null;
  cvss_score: number | null;
}

interface Props {
  cves: Vulnerabilidad[];
}

export default function GraficoSeveridad({ cves }: Props) {
  // Conteo dinámico de severidades
  const conteo: Record<string, number> = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    UNKNOWN: 0,
  };

  cves.forEach((c) => {
    const sev = c.cvss_severity?.toUpperCase() || "UNKNOWN";
    if (conteo[sev] !== undefined) {
      conteo[sev]++;
    } else {
      conteo["UNKNOWN"]++;
    }
  });

  const data = [
    { name: "Crítica", count: conteo.CRITICAL, color: "#f43f5e" }, // rose-500
    { name: "Alta", count: conteo.HIGH, color: "#f59e0b" },        // amber-500
    { name: "Media", count: conteo.MEDIUM, color: "#eab308" },      // yellow-500
    { name: "Baja", count: conteo.LOW, color: "#3b82f6" },         // blue-500
    { name: "Desconocida", count: conteo.UNKNOWN, color: "#64748b" }, // slate-500
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-10">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-white">Perfil de Severidad (CVSS v3.x / v4.0)</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Distribución cuantitativa de las amenazas según su nivel de impacto operacional.
        </p>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <XAxis
              dataKey="name"
              stroke="#64748b"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#64748b"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#020617",
                borderColor: "#1e293b",
                borderRadius: "0.75rem",
                color: "#f8fafc",
                fontSize: "12px",
              }}
              cursor={{ fill: "rgba(255, 255, 255, 0.05)" }}
            />
            <Bar dataKey="count" radius={[6, 6, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}