'use client';

// Charts.tsx — Gráficos reutilizables con recharts
import {
  LineChart as ReLineChart, Line, BarChart as ReBarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

// ── Tooltip personalizado ──────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: {
  active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="mono text-text-dim mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-bold">{p.value}</span>
        </p>
      ))}
    </div>
  );
};

// ── LineChart: Llamadas por día ──────────────────────────────────────────────
interface TrendPoint {
  date: string;
  totalCalls: number;
  resolvedByAI: number;
  escalated: number;
}

export function CallsTrendChart({ data }: { data: TrendPoint[] }) {
  const formatted = data.map(d => ({ ...d, date: d.date.slice(5) })); // MM-DD
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ReLineChart data={formatted} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#3d5170', fontFamily: 'monospace' }} />
        <YAxis tick={{ fontSize: 10, fill: '#3d5170', fontFamily: 'monospace' }} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace' }} />
        <Line type="monotone" dataKey="totalCalls"  name="Total"       stroke="#00e5ff" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="resolvedByAI" name="Resueltas IA" stroke="#10d98a" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="escalated"   name="Escaladas"   stroke="#f97316" strokeWidth={2} dot={false} />
      </ReLineChart>
    </ResponsiveContainer>
  );
}

// ── BarChart: Llamadas por hora ──────────────────────────────────────────────
export function HourlyChart({ data }: { data: number[] }) {
  const formatted = data.map((count, h) => ({
    hour: `${h.toString().padStart(2,'0')}h`,
    llamadas: count,
  }));
  return (
    <ResponsiveContainer width="100%" height={180}>
      <ReBarChart data={formatted} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" vertical={false} />
        <XAxis dataKey="hour" tick={{ fontSize: 9, fill: '#3d5170', fontFamily: 'monospace' }} />
        <YAxis tick={{ fontSize: 10, fill: '#3d5170', fontFamily: 'monospace' }} />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="llamadas" fill="#3b82f6" radius={[3,3,0,0]} />
      </ReBarChart>
    </ResponsiveContainer>
  );
}

// ── BarChart Horizontal: Razones de escalamiento ────────────────────────────
export function EscalationReasonsChart({ data }: { data: Array<{ reason: string; count: number }> }) {
  const short = data.map(d => ({
    ...d,
    reason: d.reason.length > 28 ? d.reason.slice(0, 26) + '…' : d.reason,
  }));
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 44)}>
      <ReBarChart data={short} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10, fill: '#3d5170', fontFamily: 'monospace' }} />
        <YAxis type="category" dataKey="reason" width={160}
          tick={{ fontSize: 10, fill: '#8899b4', fontFamily: 'monospace' }} />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="count" name="Casos" fill="#f97316" radius={[0,3,3,0]} />
      </ReBarChart>
    </ResponsiveContainer>
  );
}

// ── BarChart: Agentes ───────────────────────────────────────────────────────
export function AgentsChart({ data }: { data: Array<{ agent: string; calls: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ReBarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" vertical={false} />
        <XAxis dataKey="agent" tick={{ fontSize: 10, fill: '#3d5170', fontFamily: 'monospace' }} />
        <YAxis tick={{ fontSize: 10, fill: '#3d5170', fontFamily: 'monospace' }} />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="calls" name="Llamadas" fill="#10d98a" radius={[3,3,0,0]} />
      </ReBarChart>
    </ResponsiveContainer>
  );
}
