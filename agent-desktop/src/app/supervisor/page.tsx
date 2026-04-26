'use client';

import { useActiveCalls } from '@/hooks/useCallQueue';
import { Phone, Bot, User, Clock, Activity } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import clsx from 'clsx';

const STATUS_META = {
  active_ai:   { label: 'Con bot IA',    color: 'text-accent-blue',   dot: 'bg-accent-blue' },
  escalated:   { label: 'En espera',     color: 'text-accent-orange', dot: 'bg-accent-orange' },
  with_agent:  { label: 'Con agente',    color: 'text-accent-green',  dot: 'bg-accent-green' },
  ended:       { label: 'Finalizada',    color: 'text-text-dim',      dot: 'bg-text-dim' },
} as const;

export default function SupervisorPage() {
  const { calls, loading } = useActiveCalls();

  const totals = {
    withAI:    calls.filter(c => c.status === 'active_ai').length,
    waiting:   calls.filter(c => c.status === 'escalated').length,
    withAgent: calls.filter(c => c.status === 'with_agent').length,
  };

  return (
    <div className="min-h-screen bg-surface-0">
      <header className="bg-surface-1 border-b border-border px-5 py-3 flex items-center gap-3">
        <Activity className="w-4 h-4 text-accent-cyan" />
        <span className="font-display font-bold text-text">Supervisor</span>
        <span className="mono text-text-dim text-xs">Vista en tiempo real</span>
        <span className="ml-auto flex items-center gap-1.5 mono text-xs text-accent-green">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse-slow" />
          LIVE
        </span>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 flex flex-col gap-6">

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: Bot,   label: 'Atendiendo IA',  value: totals.withAI,    color: 'text-accent-blue' },
            { icon: Clock, label: 'En espera',       value: totals.waiting,   color: 'text-accent-orange' },
            { icon: User,  label: 'Con agente',      value: totals.withAgent, color: 'text-accent-green' },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="card px-5 py-4 flex items-center gap-4">
              <div className={clsx('w-10 h-10 rounded-full flex items-center justify-center', {
                'bg-accent-blue/10':   color === 'text-accent-blue',
                'bg-accent-orange/10': color === 'text-accent-orange',
                'bg-accent-green/10':  color === 'text-accent-green',
              })}>
                <Icon className={clsx('w-5 h-5', color)} />
              </div>
              <div>
                <div className="label">{label}</div>
                <div className={clsx('font-display font-bold text-3xl', color)}>{value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabla de llamadas activas */}
        <div className="card overflow-hidden">
          <div className="card-header">
            <Phone className="w-4 h-4 text-accent-cyan" />
            <span className="font-semibold text-sm text-text">Llamadas activas</span>
            <span className="mono text-text-dim text-xs ml-auto">{calls.length} total</span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-text-dim text-sm">Cargando...</div>
          ) : calls.length === 0 ? (
            <div className="p-12 text-center text-text-dim text-sm">
              Sin llamadas activas en este momento
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2">
                  {['Llamante', 'Estado', 'Agente', 'Tiempo', 'Razón escalamiento'].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 label font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {calls.map(call => {
                  const meta = STATUS_META[call.status] || STATUS_META.ended;
                  return (
                    <tr key={call.callId} className="border-b border-border/50 hover:bg-surface-2 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-text">{call.callerNumber}</td>
                      <td className="px-4 py-3">
                        <span className={clsx('flex items-center gap-1.5', meta.color)}>
                          <span className={clsx('w-1.5 h-1.5 rounded-full', meta.dot)} />
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text-mid mono text-xs">
                        {call.agentId ? `ext.${call.agentId}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-text-mid mono text-xs">
                        {formatDistanceToNow(new Date(call.startedAt), { locale: es })}
                      </td>
                      <td className="px-4 py-3 text-text-dim text-xs max-w-xs truncate">
                        {call.escalationReason || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

      </main>
    </div>
  );
}
