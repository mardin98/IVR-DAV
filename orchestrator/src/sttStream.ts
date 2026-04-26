/**
 * sttStream.ts — Google Speech-to-Text Streaming
 * Recibe chunks de audio PCM de FreeSWITCH y entrega transcripciones
 */

import speech from '@google-cloud/speech';
import { EventEmitter } from 'events';

const client = new speech.SpeechClient();

interface STTConfig {
  lang: string;
}

export class STTStream extends EventEmitter {
  private recognizeStream: ReturnType<typeof client.streamingRecognize> | null = null;
  private lang: string;

  constructor({ lang }: STTConfig) {
    super();
    this.lang = lang;
  }

  start() {
    this.recognizeStream = client.streamingRecognize({
      config: {
        encoding: 'LINEAR16',
        sampleRateHertz: 8000,        // Debe coincidir con FreeSWITCH audio_sample_rate
        languageCode: this.lang,      // 'es-SV' para El Salvador
        model: 'phone_call',          // Modelo optimizado para telefonía
        useEnhanced: true,
        enableAutomaticPunctuation: true,
        speechContexts: [             // Términos bancarios para mejor reconocimiento
          {
            phrases: [
              'Davivienda', 'cuenta corriente', 'cuenta de ahorros',
              'tarjeta de crédito', 'préstamo', 'transferencia',
              'estado de cuenta', 'saldo', 'movimientos',
              'número de caso', 'cédula', 'DUI',
            ],
            boost: 15,
          },
        ],
      },
      interimResults: false,          // Solo transcripciones finales para estabilidad
    });

    this.recognizeStream.on('data', (data: speech.protos.google.cloud.speech.v1.IStreamingRecognizeResponse) => {
      const result = data.results?.[0];
      if (!result) return;

      const transcript = result.alternatives?.[0]?.transcript || '';
      const isFinal = result.isFinal || false;

      if (transcript) {
        this.emit('transcript', transcript, isFinal);
      }
    });

    this.recognizeStream.on('error', (err: Error) => {
      console.error('[STT] Error:', err.message);
      // Auto-restart en error (STT streams tienen límite de duración)
      setTimeout(() => this.restart(), 1000);
    });
  }

  sendAudio(chunk: Buffer) {
    if (this.recognizeStream?.writable) {
      this.recognizeStream.write({ audioContent: chunk });
    }
  }

  onTranscript(callback: (text: string, isFinal: boolean) => void) {
    this.on('transcript', callback);
  }

  stop() {
    this.recognizeStream?.end();
    this.recognizeStream = null;
  }

  private restart() {
    this.stop();
    this.start();
  }
}
