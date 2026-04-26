# Call Manager AI — Davivienda El Salvador

Sistema de call center con IA para primer contacto, escalamiento a agentes
humanos y gestión de Knowledge Base.

## Módulos

| Directorio | Descripción | Deploy |
|---|---|---|
| `freeswitch/` | Servidor de telefonía SIP | On-premise Debian 12 |
| `orchestrator/` | IA core: Gemini + STT/TTS | Cloud Run |
| `agent-desktop/` | Panel agentes + softphone | Cloud Run |
| `admin-ui/` | Gestión Knowledge Base | Cloud Run |
| `metrics-aggregator/` | Agregación de métricas | Cloud Run |
| `metrics-dashboard/` | Dashboard de métricas | Cloud Run |
| `alerts/` | Alertas Cloud Monitoring | Terraform |

## Instalación

Ver `docs/GUIA-COMPLETA.md` para instrucciones paso a paso.

## Stack

- **Telefonía**: FreeSWITCH (open source, on-premise)
- **IA**: Gemini 1.5 Flash + Google STT Chirp + TTS Neural2
- **Knowledge Base**: Vertex AI Search (RAG semántico)
- **Frontend**: Next.js 14 + JsSIP + Firebase
- **Backend**: Node.js + TypeScript + Cloud Run
- **Base de datos**: Firestore
- **Infra**: GCP + on-premise híbrido
