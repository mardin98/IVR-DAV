// hooks/useSoftphone.ts
// Wrapper completo de JsSIP para el softphone en browser
// Maneja: registro SIP, llamadas entrantes, answer, hangup, estado

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export type SoftphoneStatus =
  | 'idle'          // No registrado
  | 'registering'   // Conectando a FreeSWITCH
  | 'ready'         // Registrado, esperando llamadas
  | 'ringing'       // Llamada entrante
  | 'in_call'       // En llamada activa
  | 'error';        // Error de conexión

export interface SoftphoneState {
  status: SoftphoneStatus;
  callId: string | null;          // UUID FreeSWITCH de la llamada activa
  callerNumber: string | null;
  callDuration: number;           // segundos
  isMuted: boolean;
  error: string | null;
}

interface UseSoftphoneConfig {
  extension: string;              // Ej: '8001'
  password: string;
  domain: string;                 // Ej: 'davivienda.local'
  wsUrl: string;                  // Ej: 'wss://freeswitch.davivienda.internal:5066'
  enabled: boolean;
}

export function useSoftphone(config: UseSoftphoneConfig) {
  const uaRef      = useRef<InstanceType<typeof import('jssip').UA> | null>(null);
  const sessionRef = useRef<ReturnType<InstanceType<typeof import('jssip').UA>['call']> | null>(null);
  const timerRef   = useRef<NodeJS.Timeout | null>(null);

  const [state, setState] = useState<SoftphoneState>({
    status: 'idle',
    callId: null,
    callerNumber: null,
    callDuration: 0,
    isMuted: false,
    error: null,
  });

  const setStatus = (status: SoftphoneStatus) =>
    setState(s => ({ ...s, status }));

  // ── Inicializar JsSIP ────────────────────────────────────────────────────
  useEffect(() => {
    if (!config.enabled || typeof window === 'undefined') return;

    let JsSIP: typeof import('jssip');

    (async () => {
      try {
        JsSIP = await import('jssip');
        JsSIP.debug.disable('JsSIP:*');   // Silenciar logs internos en producción

        const socket = new JsSIP.WebSocketInterface(config.wsUrl);

        const ua = new JsSIP.UA({
          sockets: [socket],
          uri: `sip:${config.extension}@${config.domain}`,
          password: config.password,
          register: true,
          register_expires: 300,
          user_agent: 'CallManager-AgentDesktop/1.0',
          connection_recovery_min_interval: 2,
          connection_recovery_max_interval: 30,
        });

        // ── Eventos del UA ─────────────────────────────────────────────────
        ua.on('registered', () => {
          console.log('[Softphone] Registrado en FreeSWITCH');
          setStatus('ready');
        });

        ua.on('unregistered', () => {
          console.log('[Softphone] Desregistrado');
          setStatus('idle');
        });

        ua.on('registrationFailed', (e: { cause: string }) => {
          console.error('[Softphone] Error de registro:', e.cause);
          setState(s => ({ ...s, status: 'error', error: `Registro fallido: ${e.cause}` }));
        });

        ua.on('disconnected', () => {
          console.warn('[Softphone] WebSocket desconectado');
          setStatus('error');
        });

        // ── Llamada entrante ───────────────────────────────────────────────
        ua.on('newRTCSession', (data: {
          originator: string;
          session: ReturnType<InstanceType<typeof JsSIP.UA>['call']>;
          request: { from: { uri: { user: string } }; getHeader: (h: string) => string };
        }) => {
          if (data.originator !== 'remote') return;

          const rtcSession = data.session;
          sessionRef.current = rtcSession;

          const callerNumber = data.request.from.uri.user;
          const callId = data.request.getHeader('X-Session-Id') || null;

          setState(s => ({
            ...s,
            status: 'ringing',
            callerNumber,
            callId,
          }));

          // Eventos de la sesión RTC
          rtcSession.on('ended', () => {
            clearInterval(timerRef.current!);
            setState(s => ({
              ...s,
              status: 'ready',
              callId: null,
              callerNumber: null,
              callDuration: 0,
              isMuted: false,
            }));
            sessionRef.current = null;
          });

          rtcSession.on('failed', (e: { cause: string }) => {
            clearInterval(timerRef.current!);
            setState(s => ({
              ...s,
              status: 'ready',
              callId: null,
              callerNumber: null,
              error: `Llamada fallida: ${e.cause}`,
            }));
            sessionRef.current = null;
          });

          rtcSession.on('accepted', () => {
            // Iniciar contador de duración
            const start = Date.now();
            timerRef.current = setInterval(() => {
              setState(s => ({
                ...s,
                callDuration: Math.floor((Date.now() - start) / 1000),
              }));
            }, 1000);

            setState(s => ({ ...s, status: 'in_call' }));
          });

          // Conectar audio remoto al elemento <audio> del DOM
          rtcSession.on('peerconnection', (e: { peerconnection: RTCPeerConnection }) => {
            e.peerconnection.addEventListener('track', (trackEvent: RTCTrackEvent) => {
              const audio = document.getElementById('remote-audio') as HTMLAudioElement;
              if (audio && trackEvent.streams[0]) {
                audio.srcObject = trackEvent.streams[0];
              }
            });
          });
        });

        ua.start();
        uaRef.current = ua;
        setState(s => ({ ...s, status: 'registering' }));

      } catch (err) {
        console.error('[Softphone] Init error:', err);
        setState(s => ({ ...s, status: 'error', error: String(err) }));
      }
    })();

    return () => {
      clearInterval(timerRef.current!);
      uaRef.current?.stop();
      uaRef.current = null;
    };
  }, [config.enabled, config.wsUrl, config.extension, config.domain, config.password]);

  // ── Acciones ────────────────────────────────────────────────────────────
  const answer = useCallback(() => {
    if (!sessionRef.current) return;
    sessionRef.current.answer({
      mediaConstraints: { audio: true, video: false },
    });
  }, []);

  const hangup = useCallback(() => {
    if (!sessionRef.current) return;
    sessionRef.current.terminate();
  }, []);

  const toggleMute = useCallback(() => {
    if (!sessionRef.current) return;
    const muted = !state.isMuted;
    if (muted) sessionRef.current.mute();
    else sessionRef.current.unmute();
    setState(s => ({ ...s, isMuted: muted }));
  }, [state.isMuted]);

  return { state, answer, hangup, toggleMute };
}
