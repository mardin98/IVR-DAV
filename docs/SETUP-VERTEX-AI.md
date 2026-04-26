# GUÍA SETUP — VERTEX AI SEARCH + CLOUD STORAGE
## Módulo 3 — Call Manager AI — Davivienda

---

## PASO 1 — Habilitar APIs en GCP

```bash
gcloud config set project TU_PROJECT_ID

gcloud services enable \
  discoveryengine.googleapis.com \
  storage.googleapis.com \
  aiplatform.googleapis.com
```

---

## PASO 2 — Crear bucket de Cloud Storage para documentos

```bash
# Crear bucket en región us-east1 (misma región que el resto del proyecto)
gcloud storage buckets create gs://TU_PROJECT_ID-kb-documents \
  --location=us-east1 \
  --uniform-bucket-level-access

# Dar acceso de lectura a Vertex AI Search al bucket
gcloud storage buckets add-iam-policy-binding gs://TU_PROJECT_ID-kb-documents \
  --member="serviceAccount:service-TU_PROJECT_NUMBER@gcp-sa-discoveryengine.iam.gserviceaccount.com" \
  --role="roles/storage.objectViewer"
```

---

## PASO 3 — Crear Data Store en Vertex AI Search

### Opción A: GCP Console (recomendado para primera vez)

1. Ir a: https://console.cloud.google.com/gen-app-builder/data-stores
2. Clic en **"Create Data Store"**
3. Seleccionar **"Website"** → NO → seleccionar **"Structured or unstructured data"**
4. Data type: **"Unstructured documents"**
5. Data source: **"Cloud Storage"**
6. Bucket: `TU_PROJECT_ID-kb-documents`
7. Data Store ID: `callmanager-kb` (anota este ID, lo necesitás en .env)
8. Location: `global`
9. Clic **"Create"**

### Opción B: CLI

```bash
# Crear data store
curl -X POST \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json" \
  "https://discoveryengine.googleapis.com/v1alpha/projects/TU_PROJECT_ID/locations/global/collections/default_collection/dataStores" \
  -d '{
    "displayName": "CallManager Knowledge Base",
    "industryVertical": "GENERIC",
    "solutionTypes": ["SOLUTION_TYPE_SEARCH"],
    "contentConfig": "CONTENT_REQUIRED"
  }'
```

---

## PASO 4 — Crear Search Engine (Serving Config)

```bash
# En GCP Console:
# 1. Ir a: https://console.cloud.google.com/gen-app-builder/engines
# 2. Clic "Create Engine"
# 3. Seleccionar "Search"
# 4. Conectar al Data Store creado en el Paso 3
# 5. Engine ID: callmanager-search
# 6. Location: global
```

---

## PASO 5 — Configurar variables de entorno

```bash
# Obtener el Data Store ID (aparece en la URL de GCP Console)
# Formato: callmanager-kb_XXXXXXXXXX (con timestamp al final)

# En Secret Manager del Orchestrator (Módulo 1):
echo -n "callmanager-kb_XXXXXXXXXX" | \
  gcloud secrets create vertex-search-datastore-id --data-file=-

# En .env del Admin UI (Módulo 3):
VERTEX_SEARCH_DATASTORE_ID=callmanager-kb_XXXXXXXXXX
KB_BUCKET_NAME=TU_PROJECT_ID-kb-documents
```

---

## PASO 6 — Reemplazar knowledgeBase.ts en el Orchestrator

```bash
# Copiar el nuevo knowledgeBase.ts sobre el existente
cp modulo3/kb-backend/knowledgeBase.ts \
   modulo1/orchestrator/src/knowledgeBase.ts

# Agregar la nueva dependencia
cd modulo1/orchestrator
npm install @google-cloud/discoveryengine

# Redesplegar el Orchestrator
gcloud builds submit --config deploy/cloudbuild.yaml
```

---

## PASO 7 — Cargar artículos iniciales

```bash
# Opción 1: Usar el Admin UI
npm run dev   # En modulo3/admin-ui
# Abrir http://localhost:3001
# Ir a "Nuevo artículo" y crear los primeros artículos

# Opción 2: Script de seed inicial
node scripts/seed-kb.js   # (crear este script con artículos base de Davivienda)
```

---

## PASO 8 — Verificar que funciona

```bash
# 1. Crear un artículo desde el Admin UI
# 2. Ir a "Probar KB"
# 3. Escribir una pregunta relacionada al artículo
# 4. Verificar que aparece en los resultados

# También verificar en los logs del Orchestrator:
gcloud run services logs read callmanager-orchestrator --region=us-east1 --limit=50
# Buscar: "[KB] Documento indexado:" y "[KB] Encontré X resultado(s)"
```

---

## TIMEOUTS Y DELAYS ESPERADOS

- **Indexación de artículo nuevo**: ~30 segundos en aparecer en búsquedas
- **Indexación de archivo PDF subido**: ~2-5 minutos (Vertex AI lo procesa en background)
- **Latencia de búsqueda**: ~200-500ms (incluida en el tiempo de respuesta del bot)

---

## COSTOS ESTIMADOS (Vertex AI Search)

| Uso | Costo |
|---|---|
| Indexación (documentos) | $0.002 por documento/mes |
| Queries de búsqueda | $2.50 por 1,000 queries |
| 3,000 llamadas/mes × ~2 searches/llamada | ~$15/mes |
| Alternativa: Firestore + embeddings propios | ~$0-3/mes (mayor latencia) |
