/**
 * firestoreStore.ts — Persistencia de sesiones en Firestore
 */

import { Firestore } from '@google-cloud/firestore';

const db = new Firestore({
  projectId: process.env.GCP_PROJECT_ID,
});

const COLLECTION = 'call_sessions';

export interface SessionMessage {
  role: 'user' | 'assistant';
  content: string;
  ts: string;
}

export interface SessionData {
  callId: string;
  callerNumber: string;
  startedAt: string;
  endedAt?: string;
  status: 'active_ai' | 'escalated' | 'with_agent' | 'ended';
  messages: SessionMessage[];
  escalationReason: string | null;
  agentId: string | null;
  summary: string | null;
}

export class CallSessionStore {
  static async save(session: SessionData): Promise<void> {
    await db.collection(COLLECTION).doc(session.callId).set(session);
  }

  static async get(callId: string): Promise<SessionData | null> {
    const doc = await db.collection(COLLECTION).doc(callId).get();
    if (!doc.exists) return null;
    return doc.data() as SessionData;
  }

  static async update(callId: string, data: Partial<SessionData>): Promise<void> {
    await db.collection(COLLECTION).doc(callId).update(data as Record<string, unknown>);
  }

  static async addMessage(callId: string, role: 'user' | 'assistant', content: string): Promise<void> {
    const message: SessionMessage = { role, content, ts: new Date().toISOString() };
    await db.collection(COLLECTION).doc(callId).update({
      messages: Firestore.FieldValue.arrayUnion(message),
    });
  }

  /** Listar sesiones activas (para el dashboard del supervisor) */
  static async listActive(): Promise<SessionData[]> {
    const snapshot = await db
      .collection(COLLECTION)
      .where('status', 'in', ['active_ai', 'escalated'])
      .orderBy('startedAt', 'desc')
      .limit(50)
      .get();

    return snapshot.docs.map(d => d.data() as SessionData);
  }
}
