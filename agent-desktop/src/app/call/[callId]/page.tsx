'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from '@/hooks/useCallQueue';
import { useSoftphone } from '@/hooks/useSoftphone';
import { useAgentStore } from '@/store/agentStore';
import { OrchestratorClient } from '@/lib/orchestrator';
import {
  Phone, PhoneOff, Mic, MicOff, Clock, User,
  MessageSquare, FileText, ChevronLeft, AlertCircle,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';
import clsx from 'clsx';

type Tab = 'brief' | 'conversation' | 'notes';

export default function CallPage() {
  const params    = useParams();
  const router    = useRouter();
  const callId    = params.callId as string;

  const { session } = useSession(callId);
  const { profile } = useAgentStore();

  const [activeTab, setActiveTab] = useState<Tab>('brief');
  const [notes, setNotes]         = useState('');
  const [callAccepted, setCallAccepted] = useState(false);

  const softphone = useSoftphone({
    extension:  profile?.extension  || '',
    password:   profile?.sipPassword || '',
    domain:     process.env.NEXT_PUBLIC_FREESWITCH_DOMAIN || 'davivienda.local',
    wsUrl:      process.env.NEXT_PUBLIC_FREESWITCH_WS_URL || '',
    enabled:    !!profile,
  });

  // Auto-responder cuando FreeSWITCH entrega la llamada
  useEffect(() => {
    if (softphone.state.status === 'ringing' && !callAccepted) {
      softphone.answer();
      setCallAccepted(true);
    }
  }, [softphone.state.status, callAccepted, softphone]);

  async function handleEndCall() {
    softphone.hangup();
    await OrchestratorClient.endCall(callId);
    router.push('/dashboard');
  }

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center text-text-mid">
        Cargando sesión...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-0 flex flex-col">

      {/* ── Topbar ─────────────────────────────────────────────────────────── */}
      <header className="bg-surface-1 border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.push('/dashboard')} className="btn-ghost py-1.5 px-2">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-accent-cyan" />
          <span className="font-display font-bold text-text">{session.callerNumber}</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {/* Duración de la llamada */}
          {softphone.state.status === 'in_call' && (
            <div className="flex items-center gap-1.5 mono text-accent-green">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse-slow" />
              {formatDuration(softphone.state.callDuration)}
            </div>
          )}
          {/* Estado de conexión softphone */}
          <div className={clsx('flex items-center gap-1.5 mono text-xs px-2 py-1 rounded-md border', {
            'border-accent-green/25 text-accent-green bg-accent-green/8':  softphone.state.status === 'in_call',
            'border-accent-amber/25 text-accent-amber bg-accent-amber/8': softphone.state.status === 'ringing',
            'border-border text-text-dim':                                  softphone.state.status === 'ready',
            'border-accent-red/25 text-accent-red bg-accent-red/8':        softphone.state.status === 'error',
          })}>
            {{
              idle: 'Offline', registering: 'Conectando...',
              ready: 'Listo', ringing: '⚡ Timbrando',
              in_call: '● En llamada', error: 'Error',
            }[softphone.state.status]}
          </div>
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-5 flex flex-col gap-4">

        {/* ── Softphone Controls ─────────────────────────────────────────── */}
        <div className="card px-5 py-4 flex items-center justify-between">
          <div>
            <div className="label mb-1">Control de llamada</div>
            <div className="text-text-mid text-sm">
              {softphone.state.status === 'in_call'
                ? `Conectado · ${formatDuration(softphone.state.callDuration)}`
                : softphone.state.status === 'ringing'
                ? 'Llamada entrante...'
                : 'Esperando conexión de FreeSWITCH'}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mute */}
            <button
              onClick={softphone.toggleMute}
              disabled={softphone.state.status !== 'in_call'}
              className={clsx('w-10 h-10 rounded-full border flex items-center justify-center transition-all', {
                'border-accent-amber/40 bg-accent-amber/10 text-accent-amber': softphone.state.isMuted,
                'border-border text-text-mid hover:border-border-2':           !softphone.state.isMuted,
                'opacity-30 cursor-not-allowed':                                softphone.state.status !== 'in_call',
              })}
            >
              {softphone.state.isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            {/* Answer / Hangup */}
            {softphone.state.status === 'ringing' ? (
              <button onClick={softphone.answer} className="btn-primary flex items-center gap-2 px-5 animate-ring">
                <Phone className="w-4 h-4" /> Contestar
              </button>
            ) : (
              <button
                onClick={handleEndCall}
                disabled={softphone.state.status !== 'in_call'}
                className="btn-danger flex items-center gap-2 px-5 disabled:opacity-30"
              >
                <PhoneOff className="w-4 h-4" /> Terminar
              </button>
            )}
          </div>
        </div>

        {/* ── Tabs ───────────────────────────────────────────────────────── */}
        <div className="flex gap-1 border-b border-border pb-2">
          {[
            { id: 'brief' as Tab,        icon: AlertCircle,   label: 'Brief IA' },
            { id: 'conversation' as Tab, icon: MessageSquare, label: `Conversación (${session.messages.length})` },
            { id: 'notes' as Tab,        icon: FileText,      label: 'Mis notas' },
          ].map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all', {
                'bg-surface-2 border border-border-2 text-accent-cyan': activeTab === id,
                'text-text-dim hover:text-text-mid':                    activeTab !== id,
              })}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* ── Tab Content ────────────────────────────────────────────────── */}
        <div className="flex-1">

          {/* Brief IA */}
          {activeTab === 'brief' && (
            <div className="flex flex-col gap-3 animate-fade-in">
              <div className="card p-4">
                <div className="label mb-2">Resumen generado por Gemini</div>
                <p className="text-sm text-text leading-relaxed">
                  {session.summary || 'Sin resumen disponible.'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="card px-4 py-3">
                  <div className="label mb-1">Razón de escalamiento</div>
                  <p className="text-sm text-text-mid">{session.escalationReason || '—'}</p>
                </div>
                <div className="card px-4 py-3">
                  <div className="label mb-1">Tiempo en espera</div>
                  <p className="text-sm text-text-mid flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDistanceToNow(new Date(session.startedAt), { locale: es })}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Conversación bot ↔ cliente */}
          {activeTab === 'conversation' && (
            <div className="flex flex-col gap-2 animate-fade-in">
              {session.messages.length === 0 ? (
                <p className="text-center text-text-dim text-sm py-8">Sin mensajes registrados.</p>
              ) : (
                session.messages.map((msg, i) => (
                  <div key={i} className={clsx('flex', {
                    'justify-end': msg.role === 'user',
                    'justify-start': msg.role === 'assistant',
                  })}>
                    <div className={clsx('max-w-[75%] rounded-xl px-4 py-2.5 text-sm', {
                      'bg-accent-blue/15 border border-accent-blue/20 text-text':   msg.role === 'user',
                      'bg-surface-2 border border-border text-text-mid':             msg.role === 'assistant',
                    })}>
                      <div className="label mb-1">
                        {msg.role === 'user' ? 'Cliente' : 'Bot IA'} ·{' '}
                        {format(new Date(msg.ts), 'HH:mm:ss')}
                      </div>
                      {msg.content}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Notas del agente */}
          {activeTab === 'notes' && (
            <div className="animate-fade-in">
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Escribe notas sobre esta llamada..."
                className="w-full h-48 bg-surface-1 border border-border rounded-xl px-4 py-3
                           text-sm text-text placeholder:text-text-dim resize-none
                           focus:outline-none focus:border-accent-cyan transition-colors"
              />
              <p className="text-xs text-text-dim mt-2 mono">
                Las notas se guardan localmente. Pegar en el ticket del helpdesk al cerrar.
              </p>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
