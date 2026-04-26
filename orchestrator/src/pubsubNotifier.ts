/**
 * pubsubNotifier.ts — Notificaciones al Agent Desktop via Cloud Pub/Sub
 *
 * Cuando hay un escalamiento, publica un mensaje en el topic de Pub/Sub.
 * El Agent Desktop (Next.js) está suscrito y muestra la notificación en tiempo real.
 */

import { PubSub } from '@google-cloud/pubsub';

const pubsub = new PubSub({ projectId: process.env.GCP_PROJECT_ID });
const ESCALATION_TOPIC = process.env.PUBSUB_ESCALATION_TOPIC || 'call-escalations';

export interface EscalationEvent {
  callId: string;
  callerNumber: string;
  summary: string;
  escalationReason: string;
  sessionUrl: string;
  timestamp: string;
}

export class PubSubNotifier {
  static async notifyEscalation(event: EscalationEvent): Promise<void> {
    try {
      const topic = pubsub.topic(ESCALATION_TOPIC);
      const messageId = await topic.publishMessage({
        data: Buffer.from(JSON.stringify(event)),
        attributes: {
          type: 'escalation',
          callId: event.callId,
          priority: event.escalationReason.includes('fraude') || event.escalationReason.includes('urgente')
            ? 'high'
            : 'normal',
        },
      });
      console.log(`[PubSub] Escalamiento publicado: ${messageId} callId=${event.callId}`);
    } catch (e) {
      console.error('[PubSub] Error publicando escalamiento:', e);
    }
  }
}
