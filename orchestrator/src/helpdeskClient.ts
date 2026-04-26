/**
 * helpdeskClient.ts — Conector al sistema de helpdesk interno de Davivienda
 *
 * Patrón Adapter: si el sistema interno cambia de API, solo se modifica este archivo.
 * Gemini llama funciones abstractas (getCase, createCase) sin saber el sistema concreto.
 */

interface CaseResult {
  caseId: string;
  status: string;
  subject: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  assignedTo?: string;
  resolution?: string;
}

interface CreateCaseInput {
  subject: string;
  description: string;
  category: string;
  priority: string;
  clientId?: string;
  callId: string;
}

interface CreateCaseResult {
  caseId: string;
  message: string;
  url?: string;
}

export class HelpdeskClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    // Configurar con variables de entorno
    this.baseUrl = process.env.HELPDESK_BASE_URL || 'http://helpdesk.davivienda.internal/api/v1';
    this.apiKey  = process.env.HELPDESK_API_KEY  || '';
  }

  private get headers() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      'X-Source': 'callmanager-ai',
    };
  }

  /**
   * Consultar el estado de un caso por número
   */
  async getCase(caseNumber: string, clientId?: string): Promise<CaseResult | { error: string }> {
    try {
      const url = new URL(`${this.baseUrl}/cases/${caseNumber}`);
      if (clientId) url.searchParams.set('client_id', clientId);

      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: this.headers,
        // Timeout de 5s para no bloquear la conversación
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) {
        if (res.status === 404) {
          return { error: `Caso ${caseNumber} no encontrado` };
        }
        return { error: `Error consultando caso: ${res.status}` };
      }

      const data = await res.json() as CaseResult;
      return {
        caseId: data.caseId,
        status: this.translateStatus(data.status),
        subject: data.subject,
        description: data.description,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        assignedTo: data.assignedTo,
        resolution: data.resolution,
      };
    } catch (e) {
      console.error('[Helpdesk] getCase error:', e);
      return { error: 'No se pudo consultar el sistema en este momento' };
    }
  }

  /**
   * Crear un nuevo caso
   */
  async createCase(input: CreateCaseInput): Promise<CreateCaseResult | { error: string }> {
    try {
      const payload = {
        subject: input.subject,
        description: `${input.description}\n\n[Creado automáticamente por Call Manager AI]\nLlamada ID: ${input.callId}`,
        category: input.category,
        priority: input.priority || 'media',
        client_id: input.clientId,
        source: 'telefono',
        tags: ['call-manager-ai'],
      };

      const res = await fetch(`${this.baseUrl}/cases`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        return { error: `Error creando caso: ${res.status}` };
      }

      const data = await res.json() as { id: string; case_number: string };
      return {
        caseId: data.case_number || data.id,
        message: `Caso creado exitosamente con número ${data.case_number}`,
        url: `${this.baseUrl.replace('/api/v1', '')}/cases/${data.id}`,
      };
    } catch (e) {
      console.error('[Helpdesk] createCase error:', e);
      return { error: 'No se pudo crear el caso en este momento' };
    }
  }

  /**
   * Traducir estados del sistema interno a lenguaje natural para Gemini
   */
  private translateStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'open':        'abierto y en proceso',
      'in_progress': 'siendo atendido por un agente',
      'pending':     'pendiente de respuesta',
      'resolved':    'resuelto',
      'closed':      'cerrado',
      'cancelled':   'cancelado',
    };
    return statusMap[status] || status;
  }
}
