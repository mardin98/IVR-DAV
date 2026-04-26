/**
 * geminiAgent.ts — Agente IA basado en Gemini 1.5 Flash
 *
 * Maneja:
 * - Procesamiento de intents del usuario
 * - Function calling: helpdesk interno, Knowledge Base
 * - Decisión de escalamiento con confidence score
 * - Generación de resúmenes para agentes humanos
 */

import { GoogleGenerativeAI, FunctionDeclarationsTool, Part } from '@google/generative-ai';
import { HelpdeskClient } from './helpdeskClient';
import { KnowledgeBase } from './knowledgeBase';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export type AgentAction = 'respond' | 'escalate' | 'end_call';

export interface AgentDecision {
  action: AgentAction;
  text?: string;
  confidence: number;
  escalationReason?: string;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  ts: string;
}

// ── Herramientas disponibles para Gemini (Function Calling) ─────────────────
const tools: FunctionDeclarationsTool = {
  functionDeclarations: [
    {
      name: 'buscar_en_knowledge_base',
      description: 'Busca información en la base de conocimientos del banco sobre productos, servicios, procedimientos y políticas.',
      parameters: {
        type: 'object' as const,
        properties: {
          query: {
            type: 'string',
            description: 'Pregunta o término a buscar en la base de conocimientos',
          },
        },
        required: ['query'],
      },
    },
    {
      name: 'consultar_caso_helpdesk',
      description: 'Consulta el estado de un caso o ticket en el sistema interno del banco.',
      parameters: {
        type: 'object' as const,
        properties: {
          numero_caso: {
            type: 'string',
            description: 'Número de caso o ticket a consultar',
          },
          numero_cliente: {
            type: 'string',
            description: 'Número de cliente o cédula para validar',
          },
        },
        required: ['numero_caso'],
      },
    },
    {
      name: 'crear_caso_helpdesk',
      description: 'Crea un nuevo caso en el sistema de helpdesk del banco.',
      parameters: {
        type: 'object' as const,
        properties: {
          asunto: {
            type: 'string',
            description: 'Resumen breve del problema o solicitud',
          },
          descripcion: {
            type: 'string',
            description: 'Descripción detallada del problema',
          },
          categoria: {
            type: 'string',
            enum: ['cuenta', 'tarjeta', 'prestamo', 'transferencia', 'otro'],
            description: 'Categoría del caso',
          },
          prioridad: {
            type: 'string',
            enum: ['baja', 'media', 'alta', 'urgente'],
            description: 'Prioridad del caso',
          },
          numero_cliente: {
            type: 'string',
            description: 'Número de cliente o cédula',
          },
        },
        required: ['asunto', 'descripcion', 'categoria'],
      },
    },
    {
      name: 'escalar_a_agente_humano',
      description: 'Escala la llamada a un agente humano especializado. Usar cuando: el cliente lo solicita, el problema es complejo, hay reclamos o situaciones sensibles, o la confianza en la respuesta es baja.',
      parameters: {
        type: 'object' as const,
        properties: {
          razon: {
            type: 'string',
            description: 'Razón del escalamiento para informar al agente',
          },
          urgencia: {
            type: 'string',
            enum: ['normal', 'urgente'],
            description: 'Nivel de urgencia del escalamiento',
          },
        },
        required: ['razon'],
      },
    },
  ],
};

// ── System Prompt del Agente ─────────────────────────────────────────────────
const SYSTEM_PROMPT = `Eres un asistente virtual de Davivienda El Salvador. 
Eres amable, profesional y eficiente. Hablas español de El Salvador.

REGLAS:
1. Saluda y atiende al cliente con cortesía
2. Usa las herramientas disponibles para buscar información antes de responder
3. Si no encuentras información en la Knowledge Base, escala al agente humano
4. SIEMPRE escala si el cliente menciona: fraude, reclamo formal, situación urgente, o lo solicita directamente
5. Mantén respuestas cortas y claras para conversación por voz (máximo 2-3 oraciones)
6. No repitas información que ya diste en turnos anteriores
7. Si necesitas datos del cliente (número de cuenta, cédula), pídelos de forma natural

TEMAS QUE DEBES MANEJAR:
- Consulta de saldos y movimientos
- Estado de solicitudes y casos
- Información de productos (cuentas, tarjetas, préstamos)
- Creación de reportes y casos nuevos
- Información general de servicios

TEMAS QUE SIEMPRE ESCALAN A AGENTE HUMANO:
- Fraude o transacciones no reconocidas
- Reclamos formales
- Bloqueo de tarjetas por robo
- Situaciones legales
- Quejas sobre el servicio`;

export class GeminiAgent {
  private model;
  private callId: string;
  private helpdesk: HelpdeskClient;
  private kb: KnowledgeBase;

  constructor({ callId }: { callId: string }) {
    this.callId = callId;
    this.helpdesk = new HelpdeskClient();
    this.kb = new KnowledgeBase();

    this.model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: SYSTEM_PROMPT,
      tools: [tools],
      generationConfig: {
        temperature: 0.3,      // Baja temperatura = respuestas más consistentes
        maxOutputTokens: 200,  // Respuestas cortas para voz
        topP: 0.8,
      },
    });
  }

  async getGreeting(callerNumber: string): Promise<string> {
    return `Bienvenido a Davivienda. Mi nombre es Sofia, su asistente virtual. ¿En qué le puedo ayudar el día de hoy?`;
  }

  async process(userText: string, history: Message[]): Promise<AgentDecision> {
    try {
      // Detectar intents de escalamiento explícito del usuario
      if (this.isExplicitEscalation(userText)) {
        return {
          action: 'escalate',
          confidence: 1.0,
          escalationReason: 'Solicitud directa del cliente',
        };
      }

      // Construir historial para Gemini
      const chatHistory = history.slice(-10).map(m => ({
        role: m.role === 'user' ? 'user' as const : 'model' as const,
        parts: [{ text: m.content }],
      }));

      const chat = this.model.startChat({ history: chatHistory });
      let response = await chat.sendMessage(userText);

      // ── Manejar Function Calling ─────────────────────────────────────────
      let candidate = response.response.candidates?.[0];
      let maxIterations = 5; // Evitar loops infinitos

      while (candidate?.content.parts.some((p: Part) => p.functionCall) && maxIterations-- > 0) {
        const functionCalls = candidate.content.parts
          .filter((p: Part) => p.functionCall)
          .map((p: Part) => p.functionCall!);

        const functionResponses = await Promise.all(
          functionCalls.map(async (fc) => {
            const result = await this.executeTool(fc.name, fc.args as Record<string, string>);
            return {
              functionResponse: {
                name: fc.name,
                response: { result },
              },
            };
          })
        );

        // Si alguna herramienta indica escalamiento, escalar
        const escalateResult = functionResponses.find(
          r => r.functionResponse.name === 'escalar_a_agente_humano'
        );

        if (escalateResult) {
          const args = escalateResult.functionResponse.response.result as Record<string, string>;
          return {
            action: 'escalate',
            confidence: 1.0,
            escalationReason: args.razon || 'Escalamiento por herramienta',
          };
        }

        // Continuar conversación con resultados de herramientas
        response = await chat.sendMessage(functionResponses as Parameters<typeof chat.sendMessage>[0]);
        candidate = response.response.candidates?.[0];
      }

      const text = response.response.text().trim();

      if (!text) {
        return {
          action: 'escalate',
          confidence: 0,
          escalationReason: 'Sin respuesta del modelo IA',
        };
      }

      return {
        action: 'respond',
        text,
        confidence: 0.85,
      };

    } catch (error) {
      console.error(`[GeminiAgent ${this.callId}] Error:`, error);
      return {
        action: 'escalate',
        confidence: 0,
        escalationReason: 'Error en procesamiento IA',
      };
    }
  }

  private async executeTool(name: string, args: Record<string, string>): Promise<unknown> {
    console.log(`[GeminiAgent ${this.callId}] Tool call: ${name}`, args);

    switch (name) {
      case 'buscar_en_knowledge_base':
        return await this.kb.search(args.query);

      case 'consultar_caso_helpdesk':
        return await this.helpdesk.getCase(args.numero_caso, args.numero_cliente);

      case 'crear_caso_helpdesk':
        return await this.helpdesk.createCase({
          subject: args.asunto,
          description: args.descripcion,
          category: args.categoria,
          priority: args.prioridad || 'media',
          clientId: args.numero_cliente,
          callId: this.callId,
        });

      case 'escalar_a_agente_humano':
        return args; // Manejado en el caller

      default:
        return { error: `Herramienta desconocida: ${name}` };
    }
  }

  async generateSummary(messages: Message[]): Promise<string> {
    const summaryModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const conversation = messages
      .map(m => `${m.role === 'user' ? 'Cliente' : 'Bot'}: ${m.content}`)
      .join('\n');

    const result = await summaryModel.generateContent(
      `Genera un resumen BREVE (3-4 oraciones máximo) de esta conversación telefónica para un agente humano que va a continuar la atención. Incluye: qué necesita el cliente, qué información ya se dio, y qué falta resolver.

Conversación:
${conversation}

Resumen para el agente:`
    );

    return result.response.text().trim();
  }

  private isExplicitEscalation(text: string): boolean {
    const escalationPhrases = [
      'hablar con una persona',
      'hablar con un agente',
      'hablar con alguien',
      'quiero un humano',
      'agente humano',
      'operador',
      'representante',
      'no me ayudas',
      'no entiendes',
    ];
    const lower = text.toLowerCase();
    return escalationPhrases.some(phrase => lower.includes(phrase));
  }
}
