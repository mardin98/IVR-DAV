/**
 * dailyAggregator.ts
 * Agrega todas las sesiones del día anterior en un documento DailyMetrics.
 * Se ejecuta diariamente a las 00:05 via Cloud Scheduler.
 */

import { Firestore } from '@google-cloud/firestore';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import type { DailyMetrics, SessionData } from './types';

const db = new Firestore({ projectId: process.env.GCP_PROJECT_ID });

export async function aggregateDay(targetDate?: Date): Promise<DailyMetrics> {
  const date    = targetDate || subDays(new Date(), 1);
  const dateStr = format(date, 'yyyy-MM-dd');
  const start   = startOfDay(date).toISOString();
  const end     = endOfDay(date).toISOString();

  console.log(`[Aggregator] Agregando métricas para: ${dateStr}`);

  // Obtener todas las sesiones del día
  const snap = await db
    .collection('call_sessions')
    .where('startedAt', '>=', start)
    .where('startedAt', '<=', end)
    .get();

  const sessions = snap.docs.map(d => d.data() as SessionData);
  console.log(`[Aggregator] ${sessions.length} sesiones encontradas`);

  if (sessions.length === 0) {
    const empty: DailyMetrics = {
      date: dateStr, totalCalls: 0, resolvedByAI: 0, escalated: 0,
      aiResolutionRate: 0, avgCallDurationSeconds: 0, avgWaitTimeSeconds: 0,
      escalationReasons: {}, callsByHour: new Array(24).fill(0),
      callsByAgent: {}, topKBArticles: [], createdAt: new Date().toISOString(),
    };
    await db.collection('metrics_daily').doc(dateStr).set(empty);
    return empty;
  }

  // ── Calcular métricas ──────────────────────────────────────────────────────
  const ended     = sessions.filter(s => s.endedAt);
  const escalated = sessions.filter(s => s.escalationReason);
  const resolvedByAI = sessions.filter(
    s => s.status === 'ended' && !s.escalationReason
  );

  // Duración promedio
  const durations = ended.map(s =>
    (new Date(s.endedAt!).getTime() - new Date(s.startedAt).getTime()) / 1000
  );
  const avgCallDurationSeconds = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0;

  // Tiempo de espera promedio (tiempo hasta escalamiento)
  const waitTimes = escalated
    .filter(s => s.endedAt)
    .map(s => (new Date(s.endedAt!).getTime() - new Date(s.startedAt).getTime()) / 1000);
  const avgWaitTimeSeconds = waitTimes.length
    ? Math.round(waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length)
    : 0;

  // Llamadas por hora
  const callsByHour = new Array(24).fill(0);
  sessions.forEach(s => {
    const hour = new Date(s.startedAt).getHours();
    callsByHour[hour]++;
  });

  // Razones de escalamiento
  const escalationReasons: Record<string, number> = {};
  escalated.forEach(s => {
    const reason = s.escalationReason || 'Sin razón';
    escalationReasons[reason] = (escalationReasons[reason] || 0) + 1;
  });

  // Llamadas por agente
  const callsByAgent: Record<string, number> = {};
  sessions.filter(s => s.agentId).forEach(s => {
    const agent = `ext.${s.agentId}`;
    callsByAgent[agent] = (callsByAgent[agent] || 0) + 1;
  });

  // Top artículos KB del día (desde colección knowledge_base)
  const kbSnap = await db
    .collection('knowledge_base')
    .orderBy('usageCount', 'desc')
    .limit(10)
    .get();

  const topKBArticles = kbSnap.docs.map(d => ({
    id:    d.id,
    title: (d.data().title as string) || 'Sin título',
    count: (d.data().usageCount as number) || 0,
  })).filter(a => a.count > 0);

  const metrics: DailyMetrics = {
    date:               dateStr,
    totalCalls:         sessions.length,
    resolvedByAI:       resolvedByAI.length,
    escalated:          escalated.length,
    aiResolutionRate:   sessions.length
      ? Math.round((resolvedByAI.length / sessions.length) * 100)
      : 0,
    avgCallDurationSeconds,
    avgWaitTimeSeconds,
    escalationReasons,
    callsByHour,
    callsByAgent,
    topKBArticles,
    createdAt: new Date().toISOString(),
  };

  // Guardar en Firestore
  await db.collection('metrics_daily').doc(dateStr).set(metrics);
  console.log(`[Aggregator] Métricas guardadas para ${dateStr}:`, {
    total: metrics.totalCalls,
    aiRate: `${metrics.aiResolutionRate}%`,
  });

  return metrics;
}
