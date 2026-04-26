/**
 * index.ts — Orchestrator Entry Point
 * Call Manager AI — Davivienda
 *
 * Responsabilidades:
 * - Servidor HTTP/WebSocket para recibir audio de FreeSWITCH
 * - Servidor ESL para controlar FreeSWITCH (transfers, hangups)
 * - Coordina: STT → Gemini Agent → TTS → FreeSWITCH
 */

import 'dotenv/config';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import { CallSession } from './callSession';
import { FreeSwitchESL } from './eslClient';

const PORT = parseInt(process.env.PORT || '8080');
const ESL_HOST = process.env.FREESWITCH_HOST || '127.0.0.1';
const ESL_PORT = parseInt(process.env.FREESWITCH_ESL_PORT || '8021');
const ESL_PASSWORD = process.env.FREESWITCH_ESL_PASSWORD || 'ClueCon';

const app = express();
app.use(express.json());

// ── Health check (requerido por Cloud Run) ───────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'callmanager-orchestrator', ts: new Date().toISOString() });
});

// ── Endpoint: el Agent Desktop consulta el contexto de una sesión ─────────────
app.get('/session/:callId', async (req, res) => {
  try {
    const { CallSessionStore } = await import('./firestoreStore');
    const session = await CallSessionStore.get(req.params.callId);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── Endpoint: forzar escalamiento desde el Agent Desktop ─────────────────────
app.post('/session/:callId/escalate', async (req, res) => {
  try {
    const session = activeSessions.get(req.params.callId);
    if (session) {
      await session.escalateToHuman('manual_request');
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── HTTP Server ──────────────────────────────────────────────────────────────
const server = http.createServer(app);

// ── WebSocket Server — Recibe audio stream de FreeSWITCH ─────────────────────
const wss = new WebSocketServer({ server, path: '/audio-stream' });

// Map de sesiones activas: callId → CallSession
const activeSessions = new Map<string, CallSession>();

// Conectar ESL a FreeSWITCH
const esl = new FreeSwitchESL(ESL_HOST, ESL_PORT, ESL_PASSWORD);

wss.on('connection', (ws: WebSocket, req) => {
  // Extraer parámetros de la URL: ?callId=xxx&caller=5030000&lang=es-SV
  const url = new URL(req.url || '', `http://localhost`);
  const callId = url.searchParams.get('callId') || `call_${Date.now()}`;
  const callerNumber = url.searchParams.get('caller') || 'unknown';
  const lang = url.searchParams.get('lang') || 'es-SV';

  console.log(`[Orchestrator] Nueva conexión de audio: callId=${callId} caller=${callerNumber}`);

  // Crear sesión de llamada
  const session = new CallSession({
    callId,
    callerNumber,
    lang,
    ws,
    esl,
  });

  activeSessions.set(callId, session);
  session.start();

  ws.on('close', () => {
    console.log(`[Orchestrator] Sesión cerrada: callId=${callId}`);
    session.end();
    activeSessions.delete(callId);
  });

  ws.on('error', (err) => {
    console.error(`[Orchestrator] WebSocket error callId=${callId}:`, err.message);
    session.end();
    activeSessions.delete(callId);
  });
});

// ── Arranque ─────────────────────────────────────────────────────────────────
async function main() {
  // Conectar ESL a FreeSWITCH
  try {
    await esl.connect();
    console.log(`[ESL] Conectado a FreeSWITCH en ${ESL_HOST}:${ESL_PORT}`);
  } catch (e) {
    console.warn(`[ESL] No se pudo conectar a FreeSWITCH: ${e}. Continuando en modo degradado.`);
  }

  server.listen(PORT, () => {
    console.log(`[Orchestrator] Servidor en puerto ${PORT}`);
    console.log(`[Orchestrator] WebSocket: ws://localhost:${PORT}/audio-stream`);
    console.log(`[Orchestrator] Health:    http://localhost:${PORT}/health`);
  });
}

main().catch((e) => {
  console.error('[Orchestrator] Error fatal:', e);
  process.exit(1);
});
