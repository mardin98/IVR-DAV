// aggregator/src/types.ts — Tipos de métricas del sistema

export interface DailyMetrics {
  date: string;                                         // 'YYYY-MM-DD'
  totalCalls: number;
  resolvedByAI: number;
  escalated: number;
  aiResolutionRate: number;                             // 0-100
  avgCallDurationSeconds: number;
  avgWaitTimeSeconds: number;
  escalationReasons: Record<string, number>;
  callsByHour: number[];                                // [0..23]
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

export interface AgentMetrics {
  agentId: string;                                      // extensión ej: '8001'
  date: string;
  callsHandled: number;
  avgCallDurationSeconds: number;
  totalTalkTimeSeconds: number;
}

export interface SessionData {
  callId: string;
  callerNumber: string;
  startedAt: string;
  endedAt?: string;
  status: 'active_ai' | 'escalated' | 'with_agent' | 'ended';
  messages: Array<{ role: string; content: string; ts: string }>;
  escalationReason: string | null;
  agentId: string | null;
  summary: string | null;
}
