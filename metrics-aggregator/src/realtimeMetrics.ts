// aggregator/src/realtimeMetrics.ts
// Actualiza métricas en tiempo real (se llama cada 5 min via Cloud Scheduler)

import { Firestore } from '@google-cloud/firestore';
import { startOfDay } from 'date-fns';
import type { RealtimeMetrics, SessionData } from './types';

const db = new Firestore({ projectId: process.env.GCP_PROJECT_ID });

export async function updateRealtimeMetrics(): Promise<RealtimeMetrics> {
  const todayStart = startOfDay(new Date()).toISOString();

  // Sesiones de hoy
  const snap = await db
    .collection('call_sessions')
    .where('startedAt', '>=', todayStart)
    .get();

  const all       = snap.docs.map(d => d.data() as SessionData);
  const active    = all.filter(s => s.status === 'active_ai');
  const inQueue   = all.filter(s => s.status === 'escalated');
  const withAgent = all.filter(s => s.status === 'with_agent');
  const ended     = all.filter(s => s.status === 'ended');
  const resolvedByAI = ended.filter(s => !s.escalationReason);

  const waitTimes = all
    .filter(s => s.escalationReason && s.endedAt)
    .map(s => (new Date(s.endedAt!).getTime() - new Date(s.startedAt).getTime()) / 1000);

  const metrics: RealtimeMetrics = {
    id:                   'current',
    updatedAt:            new Date().toISOString(),
    activeCalls:          active.length,
    callsInQueue:         inQueue.length,
    callsWithAgent:       withAgent.length,
    callsToday:           all.length,
    resolvedByAIToday:    resolvedByAI.length,
    aiResolutionRateToday: ended.length
      ? Math.round((resolvedByAI.length / ended.length) * 100)
      : 0,
    avgWaitTimeToday: waitTimes.length
      ? Math.round(waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length)
      : 0,
  };

  await db.collection('metrics_realtime').doc('current').set(metrics);
  return metrics;
}
