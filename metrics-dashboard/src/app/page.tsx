'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Phone, Bot, Users, Clock, TrendingUp,
  Download, RefreshCw, Activity, BookOpen,
} from 'lucide-react';
import { KPICard } from '@/components/KPICard';
import {
  CallsTrendChart, HourlyChart,
  EscalationReasonsChart, AgentsChart,
} from '@/components/Charts';
import clsx from 'clsx';

type Period = 7 | 14 | 30;

interface Metrics {
  totalCalls: number;
  resolvedByAI: number;
  escalated: number;
  aiResolutionRate: number;
  avgCallDurationSeconds: number;
  avgWaitTimeSeconds: number;
  trend: Array<{ date: string; totalCalls: number; resolvedByAI: number; escalated: number; aiRate: number }>;
  topReasons: Array<{ reason: string; count: number }>;
  callsByHour: number[];
  topAgents: Array<{ agent: string; calls: number }>;
  topKBArticles: Array<{ id: string; title: string; count: number }>;
  periodDays: number;
}

interface Realtime {
  activeCalls: number;
  callsInQueue: number;
  callsWithAgent: number;
  callsToday: number;
  aiResolutionRateToday: number;
  avgWaitTimeToday: number;
  updatedAt: string;
}

const fmtSecs = (s: number) => s < 60 ? `${s}s` : `${Math.floor(s/60)}m ${s%60}s`;

export default function MetricsDashboard() {
  const [period,   setPeriod]   = useState<Period>(7);
  const [metrics,  setMetrics]  = useState<Metrics | null>(null);
  const [realtime, setRealtime] = useState<Realtime | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [lastRefresh, setLastRefresh] = useState('');

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    const [m, r] = await Promise.all([
      fetch(`/api/metrics?days=${period}`).then(r => r.json()),
      fetch('/api/realtime').then(r => r.json()),
    ]);
    setMetrics(m);
    setRealtime(r);
    setLastRefresh(new Date().toLocaleTimeString('es-SV'));
    setLoading(false);
  }, [period]);

  useEffect(() => { fetchMetrics(); }, [fetchMetrics]);

  // Auto-refresh cada 60s
  useEffect(() => {
    const t = setInterval(fetchMetrics, 60_000);
    return () => clearInterval(t);
  }, [fetchMetrics]);

  function handleExport() {
    window.open(`/api/export?days=${period}`, '_blank');
  }

  return (
    <div className="min-h-screen bg-surface-0">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-surface-1 border-b border-border px-5 py-3 flex items-center gap-3">
        <Activity className="w-4 h-4 text-accent-cyan" />
        <span className="font-display font-bold text-text">Métricas</span>
        <span className="mono text-text-dim text-xs">Call Manager AI</span>

        <div className="ml-auto flex items-center gap-2">
          {/* Selector de período */}
          <div className="flex bg-surface-2 border border-border rounded-lg overflow-hidden">
            {([7, 14, 30] as Period[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={clsx('px-3 py-1.5 mono text-xs transition-all', {
                  'bg-surface-3 text-accent-cyan': period === p,
                  'text-text-dim hover:text-text-mid': period !== p,
                })}>
                {p}d
              </button>
            ))}
          </div>

          <button onClick={handleExport} className="btn-ghost flex items-center gap-1.5 py-1.5 px-3 text-xs">
            <Download className="w-3.5 h-3.5" /> CSV
          </button>

          <button onClick={fetchMetrics} disabled={loading}
            className="btn-ghost flex items-center gap-1.5 py-1.5 px-3 text-xs">
            <RefreshCw className={clsx('w-3.5 h-3.5', loading && 'animate-spin')} />
            {lastRefresh || 'Actualizar'}
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 flex flex-col gap-6">

        {/* ── Realtime strip ─────────────────────────────────────────────── */}
        {realtime && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Activas ahora',  value: realtime.activeCalls,    color: 'bg-accent-blue/10  text-accent-blue',   dot: 'bg-accent-blue' },
              { label: 'En cola',        value: realtime.callsInQueue,   color: 'bg-accent-orange/10 text-accent-orange', dot: 'bg-accent-orange' },
              { label: 'Con agente',     value: realtime.callsWithAgent, color: 'bg-accent-green/10 text-accent-green',  dot: 'bg-accent-green' },
              { label: 'Total hoy',      value: realtime.callsToday,     color: 'bg-accent-cyan/10  text-accent-cyan',   dot: 'bg-accent-cyan' },
            ].map(({ label, value, color, dot }) => (
              <div key={label} className={clsx('rounded-xl border border-border/50 px-4 py-3 flex items-center gap-3', color.split(' ')[0])}>
                <span className={clsx('w-2 h-2 rounded-full flex-shrink-0 animate-pulse-slow', dot)} />
                <div>
                  <div className="label">{label}</div>
                  <div className={clsx('font-display font-bold text-2xl', color.split(' ')[1])}>{value}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── KPIs del período ─────────────────────────────────────────── */}
        {metrics && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KPICard label="Total llamadas"    value={metrics.totalCalls}           icon={Phone}     color="cyan"  />
            <KPICard label="Resueltas por IA"  value={metrics.resolvedByAI}         icon={Bot}       color="green" />
            <KPICard label="Escaladas"         value={metrics.escalated}            icon={Users}     color="orange"/>
            <KPICard label="Tasa IA"           value={`${metrics.aiResolutionRate}%`} icon={TrendingUp} color="blue" />
            <KPICard label="Duración prom."    value={fmtSecs(metrics.avgCallDurationSeconds)} icon={Clock} color="amber" />
            <KPICard label="Espera prom."      value={fmtSecs(metrics.avgWaitTimeSeconds)}     icon={Clock} color="red"   />
          </div>
        )}

        {/* ── Gráficos fila 1 ──────────────────────────────────────────── */}
        {metrics && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Trend línea */}
            <div className="card lg:col-span-2">
              <div className="card-header">
                <TrendingUp className="w-4 h-4 text-accent-cyan" />
                <span className="text-sm font-semibold text-text">Llamadas por día</span>
              </div>
              <div className="px-4 pt-3 pb-4">
                <CallsTrendChart data={metrics.trend} />
              </div>
            </div>

            {/* Razones escalamiento */}
            <div className="card">
              <div className="card-header">
                <Users className="w-4 h-4 text-accent-orange" />
                <span className="text-sm font-semibold text-text">Top razones de escalamiento</span>
              </div>
              <div className="px-4 pt-3 pb-4">
                {metrics.topReasons.length > 0
                  ? <EscalationReasonsChart data={metrics.topReasons} />
                  : <p className="text-text-dim text-xs text-center py-8">Sin datos</p>
                }
              </div>
            </div>
          </div>
        )}

        {/* ── Gráficos fila 2 ──────────────────────────────────────────── */}
        {metrics && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Llamadas por hora */}
            <div className="card">
              <div className="card-header">
                <Clock className="w-4 h-4 text-accent-blue" />
                <span className="text-sm font-semibold text-text">Distribución por hora</span>
              </div>
              <div className="px-4 pt-3 pb-4">
                <HourlyChart data={metrics.callsByHour} />
              </div>
            </div>

            {/* Agentes */}
            <div className="card">
              <div className="card-header">
                <Users className="w-4 h-4 text-accent-green" />
                <span className="text-sm font-semibold text-text">Llamadas por agente</span>
              </div>
              <div className="px-4 pt-3 pb-4">
                {metrics.topAgents.length > 0
                  ? <AgentsChart data={metrics.topAgents} />
                  : <p className="text-text-dim text-xs text-center py-8">Sin datos de agentes</p>
                }
              </div>
            </div>
          </div>
        )}

        {/* ── Top KB Articles ───────────────────────────────────────────── */}
        {metrics && metrics.topKBArticles.length > 0 && (
          <div className="card">
            <div className="card-header">
              <BookOpen className="w-4 h-4 text-accent-purple" />
              <span className="text-sm font-semibold text-text">Artículos KB más consultados por el bot</span>
            </div>
            <div className="divide-y divide-border">
              {metrics.topKBArticles.slice(0, 8).map((a, i) => (
                <div key={a.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2 transition-colors">
                  <span className="mono text-text-dim text-xs w-5 text-right">{i + 1}</span>
                  <span className="flex-1 text-sm text-text truncate">{a.title}</span>
                  <span className="mono text-accent-cyan text-xs">{a.count}×</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading && !metrics && (
          <div className="text-center text-text-dim text-sm py-20">Cargando métricas...</div>
        )}

      </main>
    </div>
  );
}
