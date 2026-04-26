/**
 * orchestrator-patch/metrics.ts
 * Agregar al Orchestrator existente (Módulo 1) para logging estructurado
 * y custom metrics en Cloud Monitoring.
 *
 * USO: importar en callSession.ts y llamar los métodos en los eventos clave.
 */

import { MetricServiceClient } from '@google-cloud/monitoring';

const PROJECT_ID = process.env.GCP_PROJECT_ID!;
const monClient  = new MetricServiceClient();
const PROJECT_NAME = `projects/${PROJECT_ID}`;

// ── Logging estructurado (Cloud Logging lee JSON de stdout) ──────────────────

export const log = {
  info:  (event: string, data: object = {}) =>
    console.log(JSON.stringify({ severity: 'INFO',  event, ...data, ts: new Date().toISOString() })),
  warn:  (event: string, data: object = {}) =>
    console.log(JSON.stringify({ severity: 'WARNING', event, ...data, ts: new Date().toISOString() })),
  error: (event: string, data: object = {}) =>
    console.error(JSON.stringify({ severity: 'ERROR', event, ...data, ts: new Date().toISOString() })),
};

// ── Custom Metrics Cloud Monitoring ──────────────────────────────────────────

type MetricType =
  | 'call_started'
  | 'call_ended'
  | 'call_escalated'
  | 'call_resolved_by_ai'
  | 'stt_error'
  | 'gemini_error'
  | 'tool_call';

export async function recordMetric(type: MetricType, value = 1): Promise<void> {
  try {
    const now = new Date();
    await monClient.createTimeSeries({
      name: PROJECT_NAME,
      timeSeries: [{
        metric: {
          type: `custom.googleapis.com/callmanager/${type}`,
          labels: { service: 'orchestrator' },
        },
        resource: {
          type: 'global',
          labels: { project_id: PROJECT_ID },
        },
        points: [{
          interval: {
            endTime: { seconds: Math.floor(now.getTime() / 1000), nanos: 0 },
          },
          value: { int64Value: value },
        }],
      }],
    });
  } catch {
    // No bloquear el flujo de llamada por un error de métricas
  }
}

// ── Eventos estándar a registrar en callSession.ts ───────────────────────────

export class CallMetrics {
  private callId: string;
  private startTime: number;

  constructor(callId: string) {
    this.callId    = callId;
    this.startTime = Date.now();
  }

  onCallStarted(callerNumber: string) {
    log.info('call_started', { callId: this.callId, callerNumber });
    recordMetric('call_started').catch(() => {});
  }

  onCallEnded(status: string) {
    const durationSecs = Math.round((Date.now() - this.startTime) / 1000);
    log.info('call_ended', { callId: this.callId, status, durationSecs });
    recordMetric('call_ended').catch(() => {});
  }

  onEscalated(reason: string) {
    const waitSecs = Math.round((Date.now() - this.startTime) / 1000);
    log.info('call_escalated', { callId: this.callId, reason, waitSecs });
    recordMetric('call_escalated').catch(() => {});
  }

  onResolvedByAI() {
    const durationSecs = Math.round((Date.now() - this.startTime) / 1000);
    log.info('call_resolved_ai', { callId: this.callId, durationSecs });
    recordMetric('call_resolved_by_ai').catch(() => {});
  }

  onToolCall(toolName: string) {
    log.info('tool_call', { callId: this.callId, toolName });
    recordMetric('tool_call').catch(() => {});
  }

  onSTTError(error: string) {
    log.error('stt_error', { callId: this.callId, error });
    recordMetric('stt_error').catch(() => {});
  }

  onGeminiError(error: string) {
    log.error('gemini_error', { callId: this.callId, error });
    recordMetric('gemini_error').catch(() => {});
  }
}
