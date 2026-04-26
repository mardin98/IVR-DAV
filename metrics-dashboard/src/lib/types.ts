// lib/types.ts — Tipos compartidos del metrics-dashboard
export interface DailyMetrics {
  date: string;
  totalCalls: number;
  resolvedByAI: number;
  escalated: number;
  aiResolutionRate: number;
  avgCallDurationSeconds: number;
  avgWaitTimeSeconds: number;
  escalationReasons: Record<string, number>;
  callsByHour: number[];
  callsByAgent: Record<string, number>;
  topKBArticles: Array<{ id: string; title: string; count: number }>;
  createdAt: string;
}

export interface RealtimeMetrics {
  id: 'current';
  updatedAt: string;
  activeCalls: number;
  callsInQueue: number;
  callsWithAgent: number;
  callsToday: number;
  resolvedByAIToday: number;
  aiResolutionRateToday: number;
  avgWaitTimeToday: number;
}
