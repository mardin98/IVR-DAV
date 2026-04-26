/**
 * callSession.ts — Ciclo de vida completo de una llamada
 *
 * Orquesta: Audio WebSocket → STT → Gemini Agent → TTS → FreeSWITCH
 */

import { WebSocket } from 'ws';
import { STTStream } from './sttStream';
import { GeminiAgent, AgentDecision } from './geminiAgent';
import { TTSClient } from './ttsClient';
import { FreeSwitchESL } from './eslClient';
import { CallSessionStore, SessionData } from './firestoreStore';
import { PubSubNotifier } from './pubsubNotifier';
import { v4 as uuidv4 } from 'uuid';

export interface CallSessionConfig {
  callId: string;
  callerNumber: string;
  lang: string;
  ws: WebSocket;
  esl: FreeSwitchESL;
}

export class CallSession {
  private callId: string;
  private callerNumber: string;
  private lang: string;
  private ws: WebSocket;
  private esl: FreeSwitchESL;

  private stt: STTStream;
  private agent: GeminiAgent;
  private tts: TTSClient;

  private sessionData: SessionData;
  private isProcessing = false;
  private isEnded = false;

  constructor(config: CallSessionConfig) {
    this.callId = config.callId;
    this.callerNumber = config.callerNumber;
    this.lang = config.lang;
    this.ws = config.ws;
    this.esl = config.esl;

    this.stt = new STTStream({ lang: this.lang });
    this.agent = new GeminiAgent({ callId: this.callId });
    this.tts = new TTSClient({ lang: this.lang });

    // Sesión inicial en Firestore
    this.sessionData = {
      callId: this.callId,
      callerNumber: this.callerNumber,
      startedAt: new Date().toISOString(),
      status: 'active_ai',
      messages: [],
      escalationReason: null,
      agentId: null,
      summary: null,
    };
  }

  async start() {
    console.log(`[Session ${this.callId}] Iniciando`);

    // Persistir sesión inicial
    await CallSessionStore.save(this.sessionData);

    // Escuchar audio chunks de FreeSWITCH
    this.ws.on('message', (data: Buffer) => {
      if (this.isEnded) return;
      // Enviar chunk de audio al STT
      this.stt.sendAudio(data);
    });

    // Suscribirse a transcripciones finales del STT
    this.stt.onTranscript(async (transcript: string, isFinal: boolean) => {
      if (!isFinal || this.isProcessing || this.isEnded) return;
      if (!transcript.trim()) return;

      this.isProcessing = true;
      console.log(`[Session ${this.callId}] Transcript: "${transcript}"`);

      try {
        await this.processUserTurn(transcript);
      } catch (e) {
        console.error(`[Session ${this.callId}] Error en turno:`, e);
      } finally {
        this.isProcessing = false;
      }
    });

    // Arrancar STT
    this.stt.start();

    // Saludo inicial del agente
    await this.sendAgentGreeting();
  }

  private async sendAgentGreeting() {
    const greeting = await this.agent.getGreeting(this.callerNumber);
    await this.speakAndSend(greeting);
    this.addMessage('assistant', greeting);
  }

  private async processUserTurn(userText: string) {
    // Guardar mensaje del usuario
    this.addMessage('user', userText);
    await CallSessionStore.addMessage(this.callId, 'user', userText);

    // Consultar al agente Gemini
    const decision: AgentDecision = await this.agent.process(userText, this.sessionData.messages);

    console.log(`[Session ${this.callId}] Decision: ${decision.action} confidence=${decision.confidence}`);

    switch (decision.action) {
      case 'respond':
        // Responder al usuario por voz
        await this.speakAndSend(decision.text!);
        this.addMessage('assistant', decision.text!);
        await CallSessionStore.addMessage(this.callId, 'assistant', decision.text!);
        break;

      case 'escalate':
        // Escalar a agente humano
        await this.escalateToHuman(decision.escalationReason || 'ai_decision');
        break;

      case 'end_call':
        // Despedida y colgar
        await this.speakAndSend(decision.text!);
        await new Promise(r => setTimeout(r, 2000));
        await this.esl.hangup(this.callId);
        break;
    }
  }

  /**
   * Convierte texto a audio y lo envía de vuelta a FreeSWITCH
   * FreeSWITCH reproduce el audio al cliente en tiempo real
   */
  private async speakAndSend(text: string) {
    if (!text.trim() || this.isEnded) return;

    try {
      const audioBuffer = await this.tts.synthesize(text);

      // Enviar audio PCM al WebSocket de FreeSWITCH
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(audioBuffer);
      }
    } catch (e) {
      console.error(`[Session ${this.callId}] TTS error:`, e);
    }
  }

  /**
   * Escala la llamada a un agente humano:
   * 1. Genera resumen de la conversación con Gemini
   * 2. Notifica al Agent Desktop via Pub/Sub
   * 3. FreeSWITCH transfiere la llamada al agente disponible
   */
  async escalateToHuman(reason: string) {
    if (this.isEnded) return;
    console.log(`[Session ${this.callId}] Escalando: ${reason}`);

    // Mensaje de espera al cliente
    await this.speakAndSend(
      'Un momento por favor, voy a transferirle con uno de nuestros agentes especializados.'
    );

    // Generar resumen inteligente con Gemini
    const summary = await this.agent.generateSummary(this.sessionData.messages);

    // Actualizar sesión en Firestore
    this.sessionData.status = 'escalated';
    this.sessionData.escalationReason = reason;
    this.sessionData.summary = summary;
    await CallSessionStore.update(this.callId, {
      status: 'escalated',
      escalationReason: reason,
      summary,
    });

    // Notificar al Agent Desktop (Next.js) via Pub/Sub
    // El panel de agentes recibe esto en tiempo real y muestra la llamada
    await PubSubNotifier.notifyEscalation({
      callId: this.callId,
      callerNumber: this.callerNumber,
      summary,
      escalationReason: reason,
      sessionUrl: `/session/${this.callId}`,
      timestamp: new Date().toISOString(),
    });

    // Esperar a que Pub/Sub asigne un agente (el Agent Desktop responde)
    // FreeSWITCH transfiere cuando el agente acepta via ESL
    console.log(`[Session ${this.callId}] Esperando asignación de agente...`);
  }

  /**
   * Transferir la llamada a un agente específico
   * Llamado por el Agent Desktop cuando el agente acepta
   */
  async transferToAgent(agentExtension: string) {
    console.log(`[Session ${this.callId}] Transfiriendo a extensión ${agentExtension}`);

    // Setear variables de contexto en FreeSWITCH para el Agent Desktop
    await this.esl.setVariable(this.callId, 'X-Session-Id', this.callId);
    await this.esl.setVariable(this.callId, 'X-AI-Brief', this.sessionData.summary || '');
    await this.esl.setVariable(this.callId, 'X-Caller-Name', this.callerNumber);

    // Transferir la llamada
    await this.esl.transfer(this.callId, agentExtension);

    this.sessionData.status = 'with_agent';
    this.sessionData.agentId = agentExtension;
    await CallSessionStore.update(this.callId, {
      status: 'with_agent',
      agentId: agentExtension,
    });
  }

  end() {
    if (this.isEnded) return;
    this.isEnded = true;
    this.stt.stop();
    console.log(`[Session ${this.callId}] Sesión terminada`);

    CallSessionStore.update(this.callId, {
      status: 'ended',
      endedAt: new Date().toISOString(),
    }).catch(console.error);
  }

  private addMessage(role: 'user' | 'assistant', content: string) {
    this.sessionData.messages.push({ role, content, ts: new Date().toISOString() });
  }
}
