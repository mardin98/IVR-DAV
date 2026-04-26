// lib/orchestrator.ts — Cliente para el Orchestrator Cloud Run
const BASE = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL!;

export interface SessionData {
  callId: string;
  callerNumber: string;
  startedAt: string;
  endedAt?: string;
  status: 'active_ai' | 'escalated' | 'with_agent' | 'ended';
  messages: Array<{ role: 'user' | 'assistant'; content: string; ts: string }>;
  escalationReason: string | null;
  agentId: string | null;
  summary: string | null;
}

async function req(path: string, method = 'GET', body?: object) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw new Error(`Orchestrator ${method} ${path} → ${res.status}`);
  return res.json();
}

export const OrchestratorClient = {
  getSession:   (callId: string): Promise<SessionData>   => req(`/session/${callId}`),
  acceptCall:   (callId: string, agentExtension: string) => req(`/session/${callId}/accept`, 'POST', { agentExtension }),
  endCall:      (callId: string)                         => req(`/session/${callId}/end`, 'POST'),
  escalate:     (callId: string)                         => req(`/session/${callId}/escalate`, 'POST'),
};
