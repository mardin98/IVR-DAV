'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useCallQueue } from '@/hooks/useCallQueue';
import { useAgentStore } from '@/store/agentStore';
import { CallCard } from '@/components/CallCard';
import { Phone, Users, Clock, Activity, LogOut, Wifi } from 'lucide-react';
import clsx from 'clsx';

const AVAILABILITY_OPTIONS = [
  { value: 'available', label: 'Disponible', color: 'bg-accent-green' },
  { value: 'busy',      label: 'Ocupado',    color: 'bg-accent-amber' },
  { value: 'away',      label: 'Ausente',    color: 'bg-accent-red' },
] as const;

export default function DashboardPage() {
  const router = useRouter();
  const { queue, loading } = useCallQueue();
  const { profile, availability, setAvailability, clearProfile } = useAgentStore();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) router.push('/login');
    });
    return () => unsub();
  }, [router]);

  function handleLogout() {
    auth.signOut();
    clearProfile();
    router.push('/login');
  }

  const currentAvail = AVAILABILITY_OPTIONS.find(o => o.value === availability);

  return (
    <div className="min-h-screen bg-surface-0 flex flex-col">

      {/* ── Topbar ─────────────────────────────────────────────────────────── */}
      <header className="bg-surface-1 border-b border-border px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Wifi className="w-4 h-4 text-accent-cyan" />
            <span className="font-display font-bold text-base text-text">Call Manager</span>
          </div>
          <span className="mono text-text-dim hidden sm:block">Agent Desktop</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Selector de disponibilidad */}
          <div className="flex items-center gap-2 bg-surface-2 border border-border rounded-lg px-3 py-1.5">
            <span className={clsx('status-dot', currentAvail?.color)} />
            <select
              value={availability}
              onChange={e => setAvailability(e.target.value as typeof availability)}
              className="bg-transparent text-xs text-text-mid focus:outline-none cursor-pointer"
            >
              {AVAILABILITY_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Perfil */}
          <div className="flex items-center gap-2 mono text-text-dim text-xs">
            <span>{profile?.name || profile?.email}</span>
            <span className="text-text-dim">ext.{profile?.extension}</span>
          </div>

          <button onClick={handleLogout} className="btn-ghost py-1.5 px-2">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6 flex flex-col gap-6">

        {/* Stats rápidas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: Phone,    label: 'En cola',      value: queue.length,  color: 'text-accent-orange' },
            { icon: Users,    label: 'Atendidas hoy', value: 0,            color: 'text-accent-green' },
            { icon: Clock,    label: 'Espera prom.',  value: '—',          color: 'text-accent-blue' },
            { icon: Activity, label: 'Resolución IA', value: '—',          color: 'text-accent-cyan' },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="card px-4 py-3">
              <div className="flex items-center justify-between mb-1">
                <span className="label">{label}</span>
                <Icon className={clsx('w-3.5 h-3.5', color)} />
              </div>
              <span className={clsx('font-display font-bold text-2xl', color)}>{value}</span>
            </div>
          ))}
        </div>

        {/* Cola de llamadas */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="label">Llamadas en espera</span>
              {queue.length > 0 && (
                <span className="bg-accent-orange/15 text-accent-orange border border-accent-orange/25
                                  text-xs font-bold mono px-2 py-0.5 rounded-full animate-pulse-slow">
                  {queue.length}
                </span>
              )}
            </div>
            {queue.length > 0 && (
              <span className="text-xs text-text-dim">
                Clic en la tarjeta para atender
              </span>
            )}
          </div>

          {loading ? (
            <div className="card p-8 text-center text-text-dim text-sm">
              Conectando a la cola...
            </div>
          ) : queue.length === 0 ? (
            <div className="card p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-surface-2 border border-border
                              flex items-center justify-center mx-auto mb-3">
                <Phone className="w-5 h-5 text-text-dim" />
              </div>
              <p className="text-text-mid text-sm">No hay llamadas en espera</p>
              <p className="text-text-dim text-xs mt-1 mono">Sistema activo — Agente IA atendiendo</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {queue.map(session => (
                <CallCard key={session.callId} session={session} />
              ))}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
