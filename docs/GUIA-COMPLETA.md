# GUÍA MAESTRA — CALL MANAGER AI
## Davivienda El Salvador — Instalación Completa
## Versión 1.0 — Todos los módulos

---

## ÍNDICE
1. [Prerequisitos](#1-prerequisitos)
2. [GCP — Setup inicial](#2-gcp--setup-inicial)
3. [FreeSWITCH — Servidor on-premise](#3-freeswitch--servidor-on-premise)
4. [Orchestrator — Cloud Run](#4-orchestrator--cloud-run)
5. [Agent Desktop — Cloud Run](#5-agent-desktop--cloud-run)
6. [Admin UI — Cloud Run](#6-admin-ui--cloud-run)
7. [Metrics Aggregator — Cloud Run](#7-metrics-aggregator--cloud-run)
8. [Metrics Dashboard — Cloud Run](#8-metrics-dashboard--cloud-run)
9. [Cloud Scheduler — Jobs automáticos](#9-cloud-scheduler--jobs-automáticos)
10. [Alertas — Terraform](#10-alertas--terraform)
11. [Verificación end-to-end](#11-verificación-end-to-end)
12. [Estructura de archivos](#12-estructura-de-archivos)
13. [Troubleshooting](#13-troubleshooting)
14. [Costos estimados](#14-costos-estimados)

---

## 1. PREREQUISITOS

### Local / Workstation
```bash
# Instalar herramientas necesarias
gcloud CLI       → https://cloud.google.com/sdk/docs/install
docker           → https://docs.docker.com/get-docker/
terraform        → https://developer.hashicorp.com/terraform/install
node 20+         → https://nodejs.org
git              → ya instalado en la mayoría de sistemas
```

### Cuentas y accesos necesarios
- ✅ Cuenta GCP con proyecto creado (Project ID anotado)
- ✅ Cuenta SignalWire (gratis) → https://id.signalwire.com (para instalar FreeSWITCH)
- ✅ Cuenta Firebase → https://console.firebase.google.com
- ✅ Gemini API Key → https://aistudio.google.com/app/apikey
- ✅ Acceso SSH a la VM on-premise Debian 12 (FreeSWITCH)
- ✅ API Key del helpdesk interno de Davivienda

---

## 2. GCP — SETUP INICIAL

### 2.1 Variables de entorno base (exportar en tu terminal)
```bash
export PROJECT_ID="tu-proyecto-gcp-id"
export REGION="us-east1"
export ZONE="us-east1-b"

gcloud config set project $PROJECT_ID
gcloud config set compute/region $REGION
```

### 2.2 Habilitar todas las APIs necesarias
```bash
gcloud services enable \
  run.googleapis.com \
  speech.googleapis.com \
  texttospeech.googleapis.com \
  firestore.googleapis.com \
  pubsub.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com \
  cloudscheduler.googleapis.com \
  monitoring.googleapis.com \
  logging.googleapis.com \
  storage.googleapis.com \
  discoveryengine.googleapis.com \
  aiplatform.googleapis.com \
  compute.googleapis.com \
  vpcaccess.googleapis.com
```

### 2.3 Crear Firestore en modo nativo
```bash
gcloud firestore databases create --region=$REGION
```

### 2.4 Crear bucket de Cloud Storage para KB
```bash
gcloud storage buckets create gs://${PROJECT_ID}-kb-documents \
  --location=$REGION \
  --uniform-bucket-level-access

# Permiso para Vertex AI Search
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
gcloud storage buckets add-iam-policy-binding gs://${PROJECT_ID}-kb-documents \
  --member="serviceAccount:service-${PROJECT_NUMBER}@gcp-sa-discoveryengine.iam.gserviceaccount.com" \
  --role="roles/storage.objectViewer"
```

### 2.5 Crear topics Pub/Sub
```bash
gcloud pubsub topics create call-escalations
gcloud pubsub subscriptions create call-escalations-sub \
  --topic=call-escalations \
  --ack-deadline=60
```

### 2.6 Crear secrets en Secret Manager
```bash
# Gemini API Key
echo -n "TU_GEMINI_API_KEY" | gcloud secrets create gemini-api-key --data-file=-

# FreeSWITCH ESL password (usar el mismo que definís en FreeSWITCH)
echo -n "ClueCon" | gcloud secrets create freeswitch-esl-password --data-file=-

# Helpdesk interno API Key
echo -n "TU_HELPDESK_API_KEY" | gcloud secrets create helpdesk-api-key --data-file=-

# Vertex AI Search Data Store ID (se agrega después de crear el data store)
# echo -n "callmanager-kb_XXXXXXXXXX" | gcloud secrets create vertex-search-datastore-id --data-file=-
```

### 2.7 VPN hacia FreeSWITCH on-premise
```bash
# Crear VPC Access Connector para que Cloud Run alcance la red interna
gcloud compute networks vpc-access connectors create callmanager-vpc-connector \
  --region=$REGION \
  --network=default \
  --range=10.8.0.0/28

# Configurar Cloud VPN (si ya tenés VPN con Davivienda, conectar a esa red)
# Si no, crear Cloud VPN Gateway:
# https://console.cloud.google.com/hybrid/vpn/tunnels
```

### 2.8 Crear Vertex AI Search Data Store
```bash
# 1. Ir a: https://console.cloud.google.com/gen-app-builder/data-stores
# 2. "Create Data Store" → "Unstructured documents" → Cloud Storage
# 3. Bucket: {PROJECT_ID}-kb-documents
# 4. Data Store ID: callmanager-kb (GCP agrega timestamp automático)
# 5. Location: global
# 6. Anotar el ID completo (ej: callmanager-kb_1721234567890)

# Guardar en Secret Manager:
echo -n "callmanager-kb_XXXXXXXXXX" | gcloud secrets create vertex-search-datastore-id --data-file=-
```

### 2.9 Firebase — Configuración
```bash
# 1. Ir a https://console.firebase.google.com
# 2. Agregar el proyecto GCP existente
# 3. Authentication → Sign-in method → Email/Password → Habilitar
# 4. Crear usuarios de agentes desde la consola de Firebase Auth
# 5. Copiar las credenciales de la web app (apiKey, authDomain, etc.)
```

---

## 3. FREESWITCH — SERVIDOR ON-PREMISE

### 3.1 Prerequisitos en la VM Debian 12
```bash
ssh usuario@192.168.1.100

# Verificar OS
cat /etc/debian_version
# Debe mostrar 12.x

# Requisitos mínimos de hardware:
# CPU: 2 cores, RAM: 2GB, Disco: 20GB
```

### 3.2 Obtener token de SignalWire (gratis)
```
1. Ir a https://id.signalwire.com
2. Registrarse con email corporativo
3. Crear proyecto → Personal Access Token
4. Copiar el token
```

### 3.3 Ejecutar instalador
```bash
# En la VM on-premise:
scp freeswitch/install.sh usuario@192.168.1.100:~/
scp freeswitch/vars.xml usuario@192.168.1.100:~/
scp freeswitch/dialplan/default.xml usuario@192.168.1.100:~/

ssh usuario@192.168.1.100

export SIGNALWIRE_TOKEN="tu_token_signalwire"
# Editar ORCHESTRATOR_URL en vars.xml con la URL real de Cloud Run
# (disponible después del paso 4)
sudo -E bash install.sh
```

### 3.4 Verificar instalación
```bash
sudo systemctl status freeswitch
sudo fs_cli -x "status"
sudo fs_cli -x "module_exists mod_audio_stream"
# Debe retornar "true"
```

### 3.5 Configurar event_socket (ESL)
```bash
sudo nano /etc/freeswitch/autoload_configs/event_socket.conf.xml
```
Verificar contenido:
```xml
<configuration name="event_socket.conf" description="Socket Client">
  <settings>
    <param name="listen-ip" value="0.0.0.0"/>
    <param name="listen-port" value="8021"/>
    <param name="password" value="ClueCon"/>
  </settings>
</configuration>
```

### 3.6 Abrir puertos del firewall
```bash
sudo ufw allow 5060/udp    # SIP
sudo ufw allow 5066/tcp    # WebSocket SIP (JsSIP)
sudo ufw allow 8021/tcp    # ESL — solo desde IP de Cloud VPN
sudo ufw allow 10000:20000/udp  # RTP media
sudo ufw reload
```

### 3.7 Configurar SIP Trunk
```bash
# Editar el perfil SIP para conectar al proveedor de telefonía
sudo nano /etc/freeswitch/sip_profiles/external.xml
# Configurar con los datos de tu proveedor SIP en El Salvador
sudo fs_cli -x "sofia reload"
```

---

## 4. ORCHESTRATOR — CLOUD RUN

### 4.1 Actualizar package.json con dependencia de Vertex AI
```bash
cd orchestrator

# Agregar dependencia nueva de Vertex AI Search (knowledgeBase.ts actualizado)
# y Cloud Monitoring (metrics.ts)
# El package.json ya está actualizado con estas dependencias
npm install
```

### 4.2 Configurar .env para desarrollo local
```bash
cp .env.example .env
nano .env

# Completar:
GCP_PROJECT_ID=tu-proyecto-id
GEMINI_API_KEY=AIza...
FREESWITCH_HOST=192.168.1.100
FREESWITCH_ESL_PORT=8021
FREESWITCH_ESL_PASSWORD=ClueCon
HELPDESK_BASE_URL=http://helpdesk.davivienda.internal/api/v1
HELPDESK_API_KEY=...
PUBSUB_ESCALATION_TOPIC=call-escalations
VERTEX_SEARCH_DATASTORE_ID=callmanager-kb_XXXXXXXXXX
KB_LOCATION=global
```

### 4.3 Probar localmente
```bash
npm run dev
# Verificar: curl http://localhost:8080/health
```

### 4.4 Deploy a Cloud Run
```bash
# Build y push
gcloud builds submit \
  --tag gcr.io/$PROJECT_ID/callmanager-orchestrator .

# Deploy
gcloud run deploy callmanager-orchestrator \
  --image gcr.io/$PROJECT_ID/callmanager-orchestrator \
  --region $REGION \
  --platform managed \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 1 \
  --max-instances 10 \
  --timeout 3600 \
  --port 8080 \
  --set-env-vars GCP_PROJECT_ID=$PROJECT_ID,PUBSUB_ESCALATION_TOPIC=call-escalations,KB_LOCATION=global \
  --set-secrets GEMINI_API_KEY=gemini-api-key:latest,FREESWITCH_ESL_PASSWORD=freeswitch-esl-password:latest,HELPDESK_API_KEY=helpdesk-api-key:latest,VERTEX_SEARCH_DATASTORE_ID=vertex-search-datastore-id:latest \
  --set-env-vars FREESWITCH_HOST=192.168.1.100,FREESWITCH_ESL_PORT=8021,HELPDESK_BASE_URL=http://helpdesk.davivienda.internal/api/v1 \
  --vpc-connector callmanager-vpc-connector \
  --allow-unauthenticated

# Guardar la URL
ORCHESTRATOR_URL=$(gcloud run services describe callmanager-orchestrator \
  --region $REGION --format='value(status.url)')
echo "Orchestrator URL: $ORCHESTRATOR_URL"
```

### 4.5 Actualizar FreeSWITCH con la URL del Orchestrator
```bash
ssh usuario@192.168.1.100
sudo nano /etc/freeswitch/vars.xml
# Reemplazar ORCHESTRATOR_URL_PLACEHOLDER por la URL real
# wss://callmanager-orchestrator-xxxxx-ue.a.run.app
sudo fs_cli -x "reloadxml"
sudo fs_cli -x "reload mod_audio_stream"
```

---

## 5. AGENT DESKTOP — CLOUD RUN

### 5.1 Configurar variables de entorno
```bash
cd agent-desktop
cp .env.example .env.local
nano .env.local

# Completar con datos de Firebase y URLs:
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tu-proyecto-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=tu-proyecto.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=000000000000
NEXT_PUBLIC_FIREBASE_APP_ID=1:000:web:...
NEXT_PUBLIC_FREESWITCH_WS_URL=wss://192.168.1.100:5066
NEXT_PUBLIC_FREESWITCH_DOMAIN=davivienda.local
NEXT_PUBLIC_ORCHESTRATOR_URL=https://callmanager-orchestrator-xxxxx-ue.a.run.app
```

### 5.2 Probar localmente
```bash
npm install
npm run dev
# Abrir http://localhost:3000
```

### 5.3 Deploy a Cloud Run
```bash
gcloud builds submit \
  --tag gcr.io/$PROJECT_ID/callmanager-agent-desktop .

gcloud run deploy callmanager-agent-desktop \
  --image gcr.io/$PROJECT_ID/callmanager-agent-desktop \
  --region $REGION \
  --platform managed \
  --memory 512Mi \
  --set-env-vars "\
NEXT_PUBLIC_FIREBASE_API_KEY=TU_KEY,\
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com,\
NEXT_PUBLIC_FIREBASE_PROJECT_ID=$PROJECT_ID,\
NEXT_PUBLIC_FREESWITCH_WS_URL=wss://192.168.1.100:5066,\
NEXT_PUBLIC_FREESWITCH_DOMAIN=davivienda.local,\
NEXT_PUBLIC_ORCHESTRATOR_URL=$ORCHESTRATOR_URL" \
  --allow-unauthenticated

AGENT_DESKTOP_URL=$(gcloud run services describe callmanager-agent-desktop \
  --region $REGION --format='value(status.url)')
echo "Agent Desktop: $AGENT_DESKTOP_URL"
```

---

## 6. ADMIN UI — CLOUD RUN

### 6.1 Configurar variables
```bash
cd admin-ui
cp .env.example .env.local
nano .env.local

GCP_PROJECT_ID=tu-proyecto-id
VERTEX_SEARCH_DATASTORE_ID=callmanager-kb_XXXXXXXXXX
KB_BUCKET_NAME=tu-proyecto-id-kb-documents
```

### 6.2 Deploy a Cloud Run
```bash
npm install
gcloud builds submit \
  --tag gcr.io/$PROJECT_ID/callmanager-admin-ui .

gcloud run deploy callmanager-admin-ui \
  --image gcr.io/$PROJECT_ID/callmanager-admin-ui \
  --region $REGION \
  --platform managed \
  --memory 512Mi \
  --set-env-vars "GCP_PROJECT_ID=$PROJECT_ID" \
  --set-secrets VERTEX_SEARCH_DATASTORE_ID=vertex-search-datastore-id:latest \
  --set-env-vars KB_BUCKET_NAME=${PROJECT_ID}-kb-documents \
  --allow-unauthenticated

ADMIN_UI_URL=$(gcloud run services describe callmanager-admin-ui \
  --region $REGION --format='value(status.url)')
echo "Admin UI: $ADMIN_UI_URL"
```

### 6.3 Cargar Knowledge Base inicial
```bash
# Abrir el Admin UI en el browser
# Ir a "Nuevo artículo" y crear los primeros 10-20 artículos
# Ejemplos de artículos iniciales:
# - Cómo consultar saldo de cuenta
# - Requisitos para préstamo personal
# - Qué hacer si no reconoces un cargo
# - Cómo hacer una transferencia
# - Horarios de atención
# - Cómo bloquear tarjeta por robo
```

---

## 7. METRICS AGGREGATOR — CLOUD RUN

### 7.1 Deploy
```bash
cd metrics-aggregator
npm install

gcloud builds submit \
  --tag gcr.io/$PROJECT_ID/callmanager-metrics-aggregator .

gcloud run deploy callmanager-metrics-aggregator \
  --image gcr.io/$PROJECT_ID/callmanager-metrics-aggregator \
  --region $REGION \
  --platform managed \
  --memory 512Mi \
  --set-env-vars GCP_PROJECT_ID=$PROJECT_ID \
  --no-allow-unauthenticated

AGGREGATOR_URL=$(gcloud run services describe callmanager-metrics-aggregator \
  --region $REGION --format='value(status.url)')
echo "Aggregator: $AGGREGATOR_URL"
```

---

## 8. METRICS DASHBOARD — CLOUD RUN

### 8.1 Deploy
```bash
cd metrics-dashboard
npm install

gcloud builds submit \
  --tag gcr.io/$PROJECT_ID/callmanager-metrics-dashboard .

gcloud run deploy callmanager-metrics-dashboard \
  --image gcr.io/$PROJECT_ID/callmanager-metrics-dashboard \
  --region $REGION \
  --platform managed \
  --memory 512Mi \
  --set-env-vars GCP_PROJECT_ID=$PROJECT_ID \
  --allow-unauthenticated

METRICS_URL=$(gcloud run services describe callmanager-metrics-dashboard \
  --region $REGION --format='value(status.url)')
echo "Metrics Dashboard: $METRICS_URL"
```

---

## 9. CLOUD SCHEDULER — JOBS AUTOMÁTICOS

```bash
# Obtener token de autenticación para los jobs
gcloud iam service-accounts create callmanager-scheduler \
  --display-name="CallManager Scheduler"

# Dar permisos para invocar Cloud Run
gcloud run services add-iam-policy-binding callmanager-metrics-aggregator \
  --region $REGION \
  --member="serviceAccount:callmanager-scheduler@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/run.invoker"

SA_EMAIL="callmanager-scheduler@${PROJECT_ID}.iam.gserviceaccount.com"

# Job 1: Agregación diaria — todos los días a las 00:05 hora de El Salvador
gcloud scheduler jobs create http callmanager-daily-aggregation \
  --location=$REGION \
  --schedule="5 0 * * *" \
  --uri="${AGGREGATOR_URL}/aggregate/daily" \
  --time-zone="America/El_Salvador" \
  --message-body='{}' \
  --oidc-service-account-email=$SA_EMAIL

# Job 2: Métricas en tiempo real — cada 5 minutos
gcloud scheduler jobs create http callmanager-realtime-metrics \
  --location=$REGION \
  --schedule="*/5 * * * *" \
  --uri="${AGGREGATOR_URL}/aggregate/realtime" \
  --time-zone="America/El_Salvador" \
  --message-body='{}' \
  --oidc-service-account-email=$SA_EMAIL

echo "Cloud Scheduler configurado"

# Verificar jobs creados
gcloud scheduler jobs list --location=$REGION
```

---

## 10. ALERTAS — TERRAFORM

```bash
cd alerts

# Inicializar Terraform
terraform init

# Planificar (revisar antes de aplicar)
terraform plan \
  -var="project_id=$PROJECT_ID" \
  -var="alert_email=tu-email@davivienda.com"

# Aplicar alertas
terraform apply \
  -var="project_id=$PROJECT_ID" \
  -var="alert_email=tu-email@davivienda.com"

# Verificar en GCP Console:
# https://console.cloud.google.com/monitoring/alerting
```

---

## 11. VERIFICACIÓN END-TO-END

### Test 1: FreeSWITCH operativo
```bash
ssh usuario@192.168.1.100
sudo fs_cli -x "status"
# Esperado: "UP X years, X days, X hours, X minutes..."

sudo fs_cli -x "sofia status"
# Esperado: ver perfil "internal" en estado RUNNING

# Test echo (marcar desde softphone o teléfono SIP)
# Extensión 9999 → debés escuchar tu propio audio
```

### Test 2: Orchestrator IA
```bash
curl $ORCHESTRATOR_URL/health
# Esperado: {"status":"ok","service":"callmanager-orchestrator",...}

# Llamar a extensión 7000 desde un teléfono SIP
# Esperado: Sofia (TTS) responde "Bienvenido a Davivienda..."
# Hablar → el bot responde con Gemini
```

### Test 3: Escalamiento
```bash
# En la llamada con el bot, decir "quiero hablar con un agente"
# Verificar en Firestore que la sesión cambia a status: 'escalated'
gcloud firestore documents list --collection=call_sessions

# Verificar en Pub/Sub que llegó el mensaje
gcloud pubsub subscriptions pull call-escalations-sub --auto-ack --limit=5
```

### Test 4: Agent Desktop
```bash
# 1. Abrir $AGENT_DESKTOP_URL en el browser
# 2. Login con credenciales de Firebase Auth
# 3. Verificar que aparece la llamada escalada en el dashboard
# 4. Hacer clic en la tarjeta → vista de llamada activa con brief de IA
```

### Test 5: Admin UI
```bash
# 1. Abrir $ADMIN_UI_URL
# 2. Crear un artículo de prueba
# 3. Ir a "Probar KB" → buscar algo relacionado al artículo
# 4. Verificar que aparece en los resultados
```

### Test 6: Métricas
```bash
# Disparar manualmente el aggregator
curl -X POST $AGGREGATOR_URL/aggregate/realtime
# Esperado: {"ok":true,"callsToday":N,"updatedAt":"..."}

# Abrir $METRICS_URL y verificar que aparecen datos
```

---

## 12. ESTRUCTURA DE ARCHIVOS

```
callmanager-complete/
│
├── freeswitch/                        ← Servidor de telefonía on-premise
│   ├── install.sh                     ← Instalador Debian 12
│   ├── vars.xml                       ← Variables globales
│   └── dialplan/
│       └── default.xml                ← Rutas de llamadas
│
├── orchestrator/                      ← Backend IA principal (Cloud Run)
│   ├── src/
│   │   ├── index.ts                   ← Entry point
│   │   ├── callSession.ts             ← Ciclo de vida de llamada
│   │   ├── geminiAgent.ts             ← Agente Gemini 1.5 Flash
│   │   ├── sttStream.ts               ← Google STT streaming
│   │   ├── ttsClient.ts               ← Google TTS
│   │   ├── eslClient.ts               ← Control FreeSWITCH
│   │   ├── helpdeskClient.ts          ← Conector helpdesk interno
│   │   ├── firestoreStore.ts          ← Persistencia sesiones
│   │   ├── pubsubNotifier.ts          ← Notificaciones escalamiento
│   │   ├── knowledgeBase.ts           ← RAG con Vertex AI Search ✅
│   │   └── metrics.ts                 ← Logging + Cloud Monitoring ✅
│   ├── package.json
│   ├── tsconfig.json
│   ├── Dockerfile
│   └── .env.example
│
├── agent-desktop/                     ← Panel agentes humanos (Cloud Run)
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── globals.css
│   │   │   ├── (auth)/login/page.tsx
│   │   │   ├── dashboard/page.tsx     ← Cola de llamadas
│   │   │   ├── call/[callId]/page.tsx ← Vista de llamada activa
│   │   │   └── supervisor/page.tsx    ← Vista supervisor
│   │   ├── components/CallCard.tsx
│   │   ├── hooks/
│   │   │   ├── useCallQueue.ts        ← Firestore real-time
│   │   │   └── useSoftphone.ts        ← JsSIP WebRTC
│   │   ├── store/agentStore.ts        ← Zustand
│   │   └── lib/firebase.ts, orchestrator.ts
│   ├── package.json
│   ├── Dockerfile
│   └── .env.example
│
├── admin-ui/                          ← Gestión Knowledge Base (Cloud Run)
│   ├── src/
│   │   ├── app/
│   │   │   ├── (admin)/
│   │   │   │   ├── layout.tsx         ← Sidebar navegación
│   │   │   │   ├── dashboard/         ← Lista artículos
│   │   │   │   ├── articles/new/      ← Crear artículo
│   │   │   │   ├── articles/[id]/     ← Editar artículo
│   │   │   │   ├── upload/            ← Subir PDF/DOCX
│   │   │   │   └── test/              ← Probar queries KB
│   │   │   └── api/
│   │   │       ├── articles/          ← CRUD artículos
│   │   │       ├── upload/            ← Upload a GCS
│   │   │       └── test/              ← Test query KB
│   │   ├── components/
│   │   │   ├── ArticleEditor.tsx
│   │   │   ├── FileUploader.tsx
│   │   │   └── KBTestPanel.tsx
│   │   └── lib/kbClient.ts, kbServer.ts
│   ├── package.json
│   ├── Dockerfile
│   └── .env.example
│
├── metrics-aggregator/                ← Agregación de métricas (Cloud Run)
│   ├── src/
│   │   ├── index.ts                   ← HTTP entry point
│   │   ├── types.ts
│   │   ├── dailyAggregator.ts         ← Métricas diarias
│   │   └── realtimeMetrics.ts         ← Métricas en tiempo real
│   ├── package.json
│   └── Dockerfile
│
├── metrics-dashboard/                 ← Dashboard de métricas (Cloud Run)
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx               ← Dashboard principal
│   │   │   └── api/metrics|realtime|export/
│   │   ├── components/
│   │   │   ├── KPICard.tsx
│   │   │   └── Charts.tsx             ← recharts
│   │   └── lib/firestoreMetrics.ts, types.ts
│   └── package.json
│
├── alerts/
│   └── monitoring.tf                  ← Alertas Cloud Monitoring (Terraform)
│
└── docs/
    ├── GUIA-COMPLETA.md               ← Este archivo
    ├── ARRANQUE-FREESWITCH.md         ← Detalle instalación FreeSWITCH
    ├── SETUP-VERTEX-AI.md             ← Detalle configuración Vertex AI
    └── contexto-proyecto-completo.md  ← Resumen ejecutivo
```

---

## 13. TROUBLESHOOTING

### FreeSWITCH no arranca
```bash
journalctl -u freeswitch -n 100 --no-pager
tail -f /var/log/freeswitch/freeswitch.log | grep -E "ERROR|CRIT"
```

### mod_audio_stream no carga
```bash
sudo fs_cli -x "module_exists mod_audio_stream"
# Si dice false: recompilar desde /tmp/mod_audio_stream
cd /tmp/mod_audio_stream && make && sudo make install
sudo fs_cli -x "reload mod_audio_stream"
```

### Orchestrator no conecta a FreeSWITCH ESL
```bash
# En la VM FreeSWITCH:
sudo ss -tlnp | grep 8021
# Debe mostrar 0.0.0.0:8021

# Verificar que el VPC Connector puede alcanzar la IP
gcloud compute networks vpc-access connectors describe callmanager-vpc-connector --region=$REGION
```

### STT no transcribe / mala calidad
```bash
# Verificar codec en FreeSWITCH
sudo fs_cli -x "show codec" | grep PCMU
# Debe aparecer PCMU/8000

# Verificar audio_sample_rate en vars.xml = 8000
```

### Gemini no responde o muy lento
```bash
# Ver logs del Orchestrator
gcloud run services logs read callmanager-orchestrator \
  --region=$REGION --limit=100 | grep -E "ERROR|gemini"

# Verificar cuota de Gemini API
# https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas
```

### Vertex AI Search no devuelve resultados
```bash
# Verificar que el Data Store está indexando
# https://console.cloud.google.com/gen-app-builder/data-stores

# Probar desde el Admin UI → "Probar KB"
# Si no devuelve nada: verificar VERTEX_SEARCH_DATASTORE_ID en secrets
gcloud secrets versions access latest --secret=vertex-search-datastore-id
```

### Agent Desktop no recibe llamadas en tiempo real
```bash
# Verificar que Firestore está actualizando la sesión
gcloud firestore documents get \
  "projects/$PROJECT_ID/databases/(default)/documents/call_sessions/CALL_ID"

# Verificar reglas de Firestore (deben permitir lectura autenticada)
# https://console.firebase.google.com/project/TU_PROYECTO/firestore/rules
```

### JsSIP no conecta al FreeSWITCH
```bash
# En el browser: F12 → Console
# Buscar errores de WebSocket

# Verificar que el puerto 5066 está abierto y accesible desde el browser
# FreeSWITCH debe tener mod_verto configurado para WebSocket
sudo fs_cli -x "verto status"
```

---

## 14. COSTOS ESTIMADOS

### 100 llamadas/día (~3,000/mes)

| Servicio | Detalle | Costo/mes |
|---|---|---|
| FreeSWITCH on-premise | Licencia $0, usar servidor existente | **$0** |
| JsSIP | Open source | **$0** |
| Gemini 1.5 Flash | ~700 tokens × 3,000 llamadas | **~$8–15** |
| Google STT Chirp | 6,000 min/mes | **~$48** |
| Google TTS Neural2 | ~1M caracteres | **~$16** |
| Cloud Run (5 servicios) | Orchestrator + 4 apps | **~$25–50** |
| Firestore | Reads/writes, storage | **~$5–10** |
| Vertex AI Search | ~6,000 queries/mes | **~$15–30** |
| Cloud Storage | Documentos KB | **~$2** |
| Cloud Monitoring | Métricas custom | **~$5** |
| Pub/Sub | Mensajes de escalamiento | **~$1** |
| Cloud Scheduler | 2 jobs | **~$0.5** |
| Cloud VPN | On-premise ↔ GCP | **~$15–20** |
| **TOTAL** | | **~$140–197/mes** |

### ROI estimado
- Call center tradicional: $800–1,500/agente/mes
- Si el bot resuelve 65% de llamadas sin agente → equivale a 65% menos de carga
- Break-even con 1 agente reemplazado = desde el primer mes

---

## URLS FINALES DEL SISTEMA

```
Orchestrator:      https://callmanager-orchestrator-xxxxx-ue.a.run.app
Agent Desktop:     https://callmanager-agent-desktop-xxxxx-ue.a.run.app
Admin UI:          https://callmanager-admin-ui-xxxxx-ue.a.run.app
Metrics Dashboard: https://callmanager-metrics-dashboard-xxxxx-ue.a.run.app
Metrics Aggregator: https://callmanager-metrics-aggregator-xxxxx-ue.a.run.app (privado)
```
