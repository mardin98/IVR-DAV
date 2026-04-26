/**
 * ttsClient.ts — Google Cloud Text-to-Speech
 * Convierte respuestas de Gemini a audio PCM para FreeSWITCH
 */

import textToSpeech from '@google-cloud/text-to-speech';

const client = new textToSpeech.TextToSpeechClient();

interface TTSConfig {
  lang: string;
}

export class TTSClient {
  private lang: string;

  constructor({ lang }: TTSConfig) {
    this.lang = lang;
  }

  async synthesize(text: string): Promise<Buffer> {
    const [response] = await client.synthesizeSpeech({
      input: { text },
      voice: {
        languageCode: this.lang,            // 'es-SV'
        name: 'es-US-Neural2-A',            // Voz femenina natural español
        // Alternativas: es-US-Neural2-B (masculina), es-US-Wavenet-A
        ssmlGender: 'FEMALE',
      },
      audioConfig: {
        audioEncoding: 'LINEAR16',          // PCM sin comprimir
        sampleRateHertz: 8000,             // Coincidir con FreeSWITCH
        speakingRate: 1.05,                // Ligeramente más rápido = más natural en voz
        pitch: 0,
        volumeGainDb: 1.0,
      },
    });

    return Buffer.from(response.audioContent as Uint8Array);
  }
}
