// hooks/useCallQueue.ts
// Escucha en tiempo real Firestore: llamadas con status 'escalated'
// Actualiza automáticamente cuando llega una nueva llamada del bot

'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { SessionData } from '@/lib/orchestrator';

export function useCallQueue() {
  const [queue, setQueue]       = useState<SessionData[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'call_sessions'),
      where('status', '==', 'escalated'),
      orderBy('startedAt', 'asc')   // FIFO: primero el que más tiempo lleva esperando
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setQueue(snap.docs.map(d => d.data() as SessionData));
        setLoading(false);
      },
      (err) => {
        console.error('[useCallQueue]', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  return { queue, loading, error };
}

// Hook para sesiones activas con agente (vista supervisor)
export function useActiveCalls() {
  const [calls, setCalls]     = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'call_sessions'),
      where('status', 'in', ['escalated', 'with_agent', 'active_ai']),
      orderBy('startedAt', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      setCalls(snap.docs.map(d => d.data() as SessionData));
      setLoading(false);
    });

    return () => unsub();
  }, []);

  return { calls, loading };
}

// Hook para una sesión individual en tiempo real
export function useSession(callId: string) {
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!callId) return;
    const { doc, onSnapshot: onSnap } = require('firebase/firestore');
    const ref = doc(db, 'call_sessions', callId);

    const unsub = onSnap(ref, (snap: { exists: () => boolean; data: () => SessionData }) => {
      if (snap.exists()) setSession(snap.data());
      setLoading(false);
    });

    return () => unsub();
  }, [callId]);

  return { session, loading };
}
