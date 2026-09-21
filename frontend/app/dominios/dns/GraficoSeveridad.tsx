
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
    { name: "Baja", count: conteo.LOW, color: "#3d7bff" },         // umbra-blue
    { name: "Desconocida", count: conteo.UNKNOWN, color: "#4d5568" }, // umbra-ink-muted
  ];

  return (
    <div className="bg-umbra-surface border border-umbra-line rounded-2xl p-6 mb-10">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-umbra-ink">Perfil de Severidad (CVSS v3.x / v4.0)</h2>
        <p className="text-xs text-umbra-ink-dim mt-0.5">
          Distribución cuantitativa de las amenazas según su nivel de impacto operacional.
        </p>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <XAxis
              dataKey="name"
              stroke="#8b95ac"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#8b95ac"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#070a10",
                borderColor: "rgba(255, 255, 255, 0.1)",
                borderRadius: "0.75rem",
                color: "#f2f5fa",
                fontSize: "12px",
                boxShadow: "0 8px 24px rgba(0, 0, 0, 0.5)",
              }}
              cursor={{ fill: "rgba(79, 216, 255, 0.06)" }}
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