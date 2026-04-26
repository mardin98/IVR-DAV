/**
 * eslClient.ts — FreeSWITCH Event Socket Library (ESL)
 *
 * Permite al Orchestrator controlar FreeSWITCH:
 * - Transferir llamadas a agentes humanos
 * - Colgar llamadas
 * - Setear variables de canal
 * - Escuchar eventos de llamada
 */

import { EventEmitter } from 'events';

// El paquete 'esl' de npm es el cliente oficial para FreeSWITCH ESL
// npm install esl @types/esl (si hay tipos disponibles)
const eslModule = require('esl');

export class FreeSwitchESL extends EventEmitter {
  private host: string;
  private port: number;
  private password: string;
  private connection: ReturnType<typeof eslModule.connection> | null = null;
  private connected = false;

  constructor(host: string, port: number, password: string) {
    super();
    this.host = host;
    this.port = port;
    this.password = password;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.connection = new eslModule.connection(
        this.host,
        this.port,
        this.password,
        () => {
          this.connected = true;
          console.log('[ESL] Autenticado con FreeSWITCH');

          // Suscribirse a todos los eventos de llamada
          this.connection.subscribe('all');

          // Escuchar eventos de hangup para limpiar sesiones
          this.connection.on('esl::event::CHANNEL_HANGUP_COMPLETE::*', (event: Record<string, () => string>) => {
            const callId = event.getHeader('Unique-ID');
            if (callId) this.emit('hangup', callId);
          });

          resolve();
        }
      );

      this.connection.on('error', (err: Error) => {
        this.connected = false;
        reject(err);
      });

      this.connection.on('esl::end', () => {
        this.connected = false;
        console.warn('[ESL] Conexión con FreeSWITCH cerrada. Reconectando...');
        setTimeout(() => this.connect().catch(console.error), 3000);
      });
    });
  }

  /**
   * Transferir una llamada a una extensión de agente humano
   * Ejemplo: transfer('call-uuid-xxx', '8001')
   */
  async transfer(callId: string, extension: string): Promise<void> {
    if (!this.connected) {
      console.warn('[ESL] No conectado, no se puede transferir');
      return;
    }

    return new Promise((resolve, reject) => {
      this.connection.api(
        `uuid_transfer ${callId} ${extension} XML default`,
        (res: { getBody: () => string }) => {
          const body = res.getBody();
          if (body.includes('+OK')) {
            console.log(`[ESL] Transferido ${callId} → ${extension}`);
            resolve();
          } else {
            reject(new Error(`ESL transfer failed: ${body}`));
          }
        }
      );
    });
  }

  /**
   * Colgar una llamada
   */
  async hangup(callId: string): Promise<void> {
    if (!this.connected) return;

    return new Promise((resolve) => {
      this.connection.api(`uuid_kill ${callId}`, () => resolve());
    });
  }

  /**
   * Setear una variable de canal (para pasar contexto al agente)
   */
  async setVariable(callId: string, varName: string, value: string): Promise<void> {
    if (!this.connected) return;

    return new Promise((resolve) => {
      const escapedValue = value.replace(/'/g, "\\'");
      this.connection.api(
        `uuid_setvar ${callId} ${varName} ${escapedValue}`,
        () => resolve()
      );
    });
  }

  /**
   * Reproducir un archivo de audio en el canal
   */
  async playFile(callId: string, filePath: string): Promise<void> {
    if (!this.connected) return;

    return new Promise((resolve) => {
      this.connection.api(`uuid_broadcast ${callId} ${filePath} both`, () => resolve());
    });
  }

  /**
   * Poner la llamada en hold (música en espera)
   */
  async hold(callId: string): Promise<void> {
    if (!this.connected) return;

    return new Promise((resolve) => {
      this.connection.api(`uuid_hold ${callId}`, () => resolve());
    });
  }

  isConnected(): boolean {
    return this.connected;
  }
}
