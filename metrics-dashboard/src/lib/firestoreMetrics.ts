// lib/firestoreMetrics.ts — Queries Firestore server-side para el dashboard
// Solo se importa en API Routes (Node.js), nunca en componentes browser

import { Firestore } from '@google-cloud/firestore';
import { format, subDays, startOfDay } from 'date-fns';
import type { DailyMetrics, RealtimeMetrics } from './types';

export type { DailyMetrics, RealtimeMetrics };

const db = new Firestore({ projectId: process.env.GCP_PROJECT_ID });

// ── Métricas diarias ──────────────────────────────────────────────────────────

export async function getDailyMetrics(date: string): Promise<DailyMetrics | null> {
  const doc = await db.collection('metrics_daily').doc(date).get();
  if (!doc.exists) return null;
  return doc.data() as DailyMetrics;
}

export async function getRangeMetrics(days = 30): Promise<DailyMetrics[]> {
  const docs = await db
    .collection('metrics_daily')
    .orderBy('date', 'desc')
    .limit(days)
    .get();
  return docs.docs.map(d => d.data() as DailyMetrics).reverse();
}

// ── Métricas en tiempo real ───────────────────────────────────────────────────

export async function getRealtimeMetrics(): Promise<RealtimeMetrics | null> {
  const doc = await db.collection('metrics_realtime').doc('current').get();
  if (!doc.exists) return null;
  return doc.data() as RealtimeMetrics;
}

// ── KPIs agregados para el dashboard principal ────────────────────────────────

export async function getDashboardKPIs(days = 7) {
  const range = await getRangeMetrics(days);

  if (range.length === 0) {
    return {
      totalCalls: 0, resolvedByAI: 0, escalated: 0,
      aiResolutionRate: 0, avgCallDurationSeconds: 0,
      avgWaitTimeSeconds: 0, trend: [],
    };
  }

  const totalCalls    = range.reduce((a, d) => a + d.totalCalls, 0);
  const resolvedByAI  = range.reduce((a, d) => a + d.resolvedByAI, 0);
  const escalated     = range.reduce((a, d) => a + d.escalated, 0);
  const aiRate        = totalCalls ? Math.round((resolvedByAI / totalCalls) * 100) : 0;
  const avgDuration   = Math.round(range.reduce((a, d) => a + d.avgCallDurationSeconds, 0) / range.length);
  const avgWait       = Math.round(range.reduce((a, d) => a + d.avgWaitTimeSeconds, 0) / range.length);

  // Trend para gráfico línea
  const trend = range.map(d => ({
    date:        d.date,
    totalCalls:  d.totalCalls,
    resolvedByAI:d.resolvedByAI,
    escalated:   d.escalated,
    aiRate:      d.aiResolutionRate,
  }));

  // Razones de escalamiento acumuladas
  const escalationReasons: Record<string, number> = {};
  range.forEach(d => {
    Object.entries(d.escalationReasons || {}).forEach(([r, c]) => {
      escalationReasons[r] = (escalationReasons[r] || 0) + c;
    });
  });

  // Top razones (máx 5)
  const topReasons = Object.entries(escalationReasons)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([reason, count]) => ({ reason, count }));

  // Llamadas por hora (promedio del período)
  const callsByHour = new Array(24).fill(0).map((_, h) => {
    const sum = range.reduce((a, d) => a + (d.callsByHour?.[h] || 0), 0);
    return Math.round(sum / range.length);
  });

  // Agentes (acumulado)
  const callsByAgent: Record<string, number> = {};
  range.forEach(d => {
    Object.entries(d.callsByAgent || {}).forEach(([agent, count]) => {
      callsByAgent[agent] = (callsByAgent[agent] || 0) + count;
    });
  });

  const topAgents = Object.entries(callsByAgent)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([agent, calls]) => ({ agent, calls }));

  // KB top artículos (del día más reciente)
  const latest = range[range.length - 1];

  return {
    totalCalls, resolvedByAI, escalated, aiResolutionRate: aiRate,
    avgCallDurationSeconds: avgDuration, avgWaitTimeSeconds: avgWait,
    trend, topReasons, callsByHour, topAgents,
    topKBArticles: latest?.topKBArticles || [],
    periodDays: days,
  };
}

// ── Export CSV ────────────────────────────────────────────────────────────────

export async function exportCSV(days = 30): Promise<string> {
  const range = await getRangeMetrics(days);
  const header = 'Fecha,Total Llamadas,Resueltas IA,Escaladas,Tasa IA %,Duración Prom (s),Espera Prom (s)\n';
  const rows = range.map(d =>
    `${d.date},${d.totalCalls},${d.resolvedByAI},${d.escalated},` +
    `${d.aiResolutionRate},${d.avgCallDurationSeconds},${d.avgWaitTimeSeconds}`
  ).join('\n');
  return header + rows;
}
