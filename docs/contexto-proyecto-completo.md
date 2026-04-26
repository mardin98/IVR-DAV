# CALL MANAGER AI — DOCUMENTACIÓN COMPLETA
## Davivienda El Salvador
## Estado: 4 módulos completados ✅

---

## RESUMEN EJECUTIVO

Sistema de Call Manager con IA para Davivienda El Salvador.
Bot de voz con Gemini 1.5 Flash para primer contacto, escalamiento inteligente
a agentes humanos con brief generado por IA, gestión de Knowledge Base y
métricas completas de operación.

---

## MÓDULOS Y TECNOLOGÍAS

### ✅ Módulo 1 — FreeSWITCH + Orchestrator IA
**Repositorio:** `modulo1/`
- **FreeSWITCH** on-premise Debian 12 — servidor de telefonía SIP/PSTN
- **mod_audio_stream** — streaming audio PCM vía WebSocket al Orchestrator
- **Orchestrator** Node.js + TypeScript en Cloud Run (us-east1)
- **Google STT Chirp v2** — transcripción en tiempo real español SV
- **Gemini 1.5 Flash** — agente conversacional con function calling
- **Google TTS Neural2** — síntesis de voz en español
- **ESL Client** — control de FreeSWITCH desde el Orchestrator
- **Firestore** — persistencia de sesiones (`call_sessions`)
- **Cloud Pub/Sub** — notificación de escalamientos (`call-escalations`)

**Flujo:** Llamada → FreeSWITCH → WebSocket PCM → STT → Gemini → TTS → audio de regreso

### ✅ Módulo 2 — Agent Desktop
**Repositorio:** `modulo2/agent-desktop/`
- **Next.js 14** App Router
- **Firebase Auth** — autenticación de agentes
- **Firestore real-time** — cola de llamadas en vivo
- **JsSIP** — softphone WebRTC en browser (sin instalar nada)
- **Zustand** — estado global del agente
- **Pantallas:** login, dashboard/cola, vista de llamada activa, supervisor

**Flujo:** escalamiento → Pub/Sub → Firestore → Agent Desktop notificado → agente acepta → ESL transfer → JsSIP activa llamada

### ✅ Módulo 3 — Knowledge Base + Admin UI
**Repositorio:** `modulo3/`
- **Vertex AI Search** — RAG semántico con embeddings
- **Cloud Storage** — almacenamiento de documentos PDF/DOCX
- **Admin UI Next.js 14** — CRUD artículos, upload archivos, panel de prueba
- **API Routes Next.js** — CRUD artículos, upload, test query
- **Firestore** — índice rápido de artículos (`knowledge_base`)

**Flujo:** Admin sube doc → Cloud Storage → Vertex AI indexa → Gemini lo usa en llamadas

### ✅ Módulo 4 — Métricas y Observabilidad
**Repositorio:** `modulo4/`
- **Aggregator** Node.js en Cloud Run — agrega métricas diarias y en tiempo real
- **Cloud Scheduler** — trigger diario a las 00:05 (diario) y cada 5min (realtime)
- **Metrics Dashboard** Next.js 14 con recharts
- **Cloud Monitoring** — alertas para cola alta, errores y latencia
- **Terraform** — infraestructura de alertas como código
- **Firestore** — colecciones `metrics_daily` y `metrics_realtime`

---

## INFRAESTRUCTURA GCP

```
GCP Project: tu-proyecto-id
Región principal: us-east1

Cloud Run Services:
  callmanager-orchestrator     ← Módulo 1
  callmanager-agent-desktop    ← Módulo 2
  callmanager-admin-ui         ← Módulo 3
  callmanager-metrics-aggregator ← Módulo 4
  callmanager-metrics-dashboard  ← Módulo 4

Firestore Collections:
  call_sessions      ← sesiones de llamadas
  knowledge_base     ← artículos de KB
  kb_files           ← archivos subidos
  metrics_daily      ← métricas agregadas diarias
  metrics_realtime   ← snapshot en tiempo real

Cloud Storage:
  {PROJECT_ID}-kb-documents    ← documentos de KB

Pub/Sub:
  call-escalations             ← notificaciones de escalamiento

Vertex AI:
  Search Data Store: callmanager-kb_{ID}

Secret Manager:
  gemini-api-key
  freeswitch-esl-password
  helpdesk-api-key
  vertex-search-datastore-id
```

---

## INFRAESTRUCTURA ON-PREMISE

```
FreeSWITCH Server:
  IP: 192.168.1.100
  OS: Debian 12
  Puertos:
    5060/UDP — SIP
    5066/TCP — WebSocket SIP (JsSIP agentes)
    8021/TCP — ESL (Orchestrator)
    10000-20000/UDP — RTP media

Conexión a GCP: VPN IPSec / Cloud VPN
```

---

## VARIABLES DE ENTORNO COMPLETAS

```env
# GCP
GCP_PROJECT_ID=tu-proyecto-id

# Gemini
GEMINI_API_KEY=AIza...

# FreeSWITCH
FREESWITCH_HOST=192.168.1.100
FREESWITCH_ESL_PORT=8021
FREESWITCH_ESL_PASSWORD=ClueCon

# Helpdesk interno
HELPDESK_BASE_URL=http://helpdesk.davivienda.internal/api/v1
HELPDESK_API_KEY=...

# Pub/Sub
PUBSUB_ESCALATION_TOPIC=call-escalations

# Vertex AI Search
VERTEX_SEARCH_DATASTORE_ID=callmanager-kb_XXXXXXXXXX

# Cloud Storage
KB_BUCKET_NAME=tu-proyecto-id-kb-documents

# Firebase (frontend)
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

# FreeSWITCH WebSocket (frontend)
NEXT_PUBLIC_FREESWITCH_WS_URL=wss://freeswitch.davivienda.internal:5066
NEXT_PUBLIC_FREESWITCH_DOMAIN=davivienda.local

# Orchestrator URL (frontend)
NEXT_PUBLIC_ORCHESTRATOR_URL=https://callmanager-orchestrator-xxxxx-ue.a.run.app

# Métricas
METRICS_AGGREGATOR_URL=https://callmanager-metrics-aggregator-xxxxx-ue.a.run.app
```

---

## COSTO MENSUAL ESTIMADO (100 llamadas/día)

| Servicio | Costo/mes |
|---|---|
| FreeSWITCH on-premise | $0 |
| JsSIP | $0 |
| Gemini 1.5 Flash | ~$8–15 |
| Google STT Chirp | ~$48 |
| Google TTS Neural2 | ~$16 |
| Cloud Run (4 servicios) | ~$20–40 |
| Firestore | ~$5–10 |
| Vertex AI Search | ~$15–30 |
| Cloud Storage | ~$2 |
| Cloud Monitoring | ~$5 |
| VPN / Networking | ~$15–20 |
| **TOTAL** | **~$134–186/mes** |

---

## ROADMAP SIGUIENTE (ideas para expansión)

- **WhatsApp/WebChat** como canal adicional (misma lógica del Orchestrator)
- **Análisis de sentimiento** en tiempo real durante la llamada
- **Sugerencias en vivo** del bot al agente humano mientras habla
- **Grabación y transcripción** completa de todas las llamadas
- **Dashboard de CSAT** (encuesta post-llamada automática por SMS)
- **Multi-idioma** (inglés para clientes de zonas turísticas)
