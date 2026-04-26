'use client';

import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Phone, Clock, AlertCircle, ChevronRight } from 'lucide-react';
import { OrchestratorClient, type SessionData } from '@/lib/orchestrator';
import { useAgentStore } from '@/store/agentStore';
import clsx from 'clsx';

interface CallCardProps {
  session: SessionData;
}

const REASON_LABELS: Record<string, { label: string; color: string }> = {
  'ai_decision':        { label: 'IA derivó',       color: 'text-accent-blue' },
  'manual_request':     { label: 'Solicitó agente', color: 'text-accent-amber' },
  'Solicitud directa del cliente': { label: 'Solicitó agente', color: 'text-accent-amber' },
  'Error en procesamiento IA':     { label: 'Error IA',        color: 'text-accent-red' },
};

export function CallCard({ session }: CallCardProps) {
  const router   = useRouter();
  const { profile, setActiveCall } = useAgentStore();

  const reasonMeta = REASON_LABELS[session.escalationReason || ''] || {
    label: session.escalationReason || 'Escalada',
    color: 'text-text-mid',
  };

  const waitTime = formatDistanceToNow(new Date(session.startedAt), {
    addSuffix: false,
    locale: es,
  });

  async function handleAccept() {
    if (!profile) return;
    try {
      await OrchestratorClient.acceptCall(session.callId, profile.extension);
      setActiveCall(session.callId);
      router.push(`/call/${session.callId}`);
    } catch (e) {
      console.error('Error aceptando llamada:', e);
    }
  }

  return (
    <div className={clsx(
      'card border-l-2 animate-slide-up',
      'hover:border-accent-cyan/40 transition-colors group cursor-pointer'
    )}
      onClick={handleAccept}
    >
      <div className="p-4 flex items-start gap-3">
        {/* Icono animado */}
        <div className="w-10 h-10 rounded-full bg-accent-orange/10 border border-accent-orange/20
                        flex items-center justify-center flex-shrink-0 animate-ring">
          <Phone className="w-4 h-4 text-accent-orange" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Número y tiempo de espera */}
          <div className="flex items-center justify-between mb-1">
            <span className="font-display font-bold text-base text-text">
              {session.callerNumber}
            </span>
            <span className="flex items-center gap-1 text-text-dim mono">
              <Clock className="w-3 h-3" />
              {waitTime}
            </span>
          </div>

          {/* Razón de escalamiento */}
          <div className="flex items-center gap-1.5 mb-2">
            <AlertCircle className="w-3 h-3 text-text-dim" />
            <span className={clsx('text-xs font-medium', reasonMeta.color)}>
              {reasonMeta.label}
            </span>
          </div>

          {/* Resumen IA */}
          {session.summary && (
            <p className="text-xs text-text-mid leading-relaxed line-clamp-2 bg-surface-2
                          border border-border rounded-lg px-3 py-2">
              {session.summary}
            </p>
          )}
        </div>

        <ChevronRight className="w-4 h-4 text-text-dim group-hover:text-accent-cyan
                                  transition-colors flex-shrink-0 mt-1" />
      </div>
    </div>
  );
}
