# GUÍA DE ARRANQUE — MÓDULO 1
## Call Manager AI — Davivienda
### FreeSWITCH (Debian 12) + Orchestrator (Cloud Run) + Gemini

---

## PARTE 1 — FreeSWITCH en la VM Debian 12

### Paso 1: Preparar la VM
```bash
# Conectarse a la VM on-premise
ssh usuario@192.168.1.100

# Actualizar el sistema
sudo apt-get update && sudo apt-get upgrade -y
```

### Paso 2: Obtener token SignalWire (gratis)
1. Ir a https://id.signalwire.com
2. Registrarse con email corporativo
3. Crear proyecto → copiar el Personal Access Token
4. Exportar en la VM:
```bash
export SIGNALWIRE_TOKEN=tu_token_aqui
```

### Paso 3: Clonar el repositorio y ejecutar instalador
```bash
# Clonar el proyecto (o copiar los archivos)
git clone https://gitlab.davivienda.com.sv/callmanager .
cd callmanager

# Dar permisos y ejecutar
chmod +x freeswitch/install.sh
sudo -E bash freeswitch/install.sh
```

### Paso 4: Verificar instalación
```bash
# Estado del servicio
sudo systemctl status freeswitch

# Consola de FreeSWITCH
sudo fs_cli

# Dentro de fs_cli:
> status              # Ver estado general
> sofia status        # Ver perfiles SIP
> module_exists mod_audio_stream  # Verificar módulo de streaming
> quit
```

### Paso 5: Configurar event_socket.conf.xml
```bash
sudo nano /etc/freeswitch/autoload_configs/event_socket.conf.xml
```
Verificar que tenga:
```xml
<configuration name="event_socket.conf" description="Socket Client">
  <settings>
    <param name="nat-map" value="false"/>
    <param name="listen-ip" value="0.0.0.0"/>
    <param name="listen-port" value="8021"/>
    <param name="password" value="ClueCon"/>  <!-- Cambiar en producción -->
    <param name="apply-inbound-acl" value="loopback.auto"/>
  </settings>
</configuration>
```

### Paso 6: Abrir puertos en firewall de la VM
```bash
# UFW (si está activo)
sudo ufw allow 5060/udp   # SIP
sudo ufw allow 5066/tcp   # WebSocket SIP (JsSIP agentes)
sudo ufw allow 8021/tcp   # ESL (solo desde GCP VPN!)
sudo ufw allow 10000:20000/udp  # RTP media

# Verificar
sudo ufw status
```

---

## PARTE 2 — GCP Setup

### Paso 1: Habilitar APIs necesarias
```bash
gcloud config set project TU_PROJECT_ID

gcloud services enable \
  run.googleapis.com \
  speech.googleapis.com \
  texttospeech.googleapis.com \
  firestore.googleapis.com \
  pubsub.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com
```

### Paso 2: Crear secrets en Secret Manager
```bash
# Gemini API Key
echo -n "AIza..." | gcloud secrets create gemini-api-key --data-file=-

# FreeSWITCH ESL password
echo -n "ClueCon" | gcloud secrets create freeswitch-esl-password --data-file=-

# Helpdesk API Key
echo -n "tu-api-key" | gcloud secrets create helpdesk-api-key --data-file=-
```

### Paso 3: Crear Firestore en modo nativo
```bash
gcloud firestore databases create --region=us-east1
```

### Paso 4: Crear topic Pub/Sub para escalamientos
```bash
gcloud pubsub topics create call-escalations
gcloud pubsub subscriptions create call-escalations-sub \
  --topic=call-escalations \
  --ack-deadline=60
```

### Paso 5: VPN hacia on-premise (para que Cloud Run alcance FreeSWITCH)
```bash
# Crear VPC Connector (Cloud Run → on-premise via VPN existente)
gcloud compute networks vpc-access connectors create callmanager-vpc-connector \
  --region=us-east1 \
  --network=default \
  --range=10.8.0.0/28
```

---

## PARTE 3 — Orchestrator: Deploy en Cloud Run

### Paso 1: Instalar dependencias
```bash
cd orchestrator
npm install
```

### Paso 2: Configurar variables locales para pruebas
```bash
cp .env.example .env
nano .env   # Completar los valores reales
```

### Paso 3: Probar localmente
```bash
npm run dev

# En otra terminal, probar health check:
curl http://localhost:8080/health
# Respuesta esperada: {"status":"ok","service":"callmanager-orchestrator",...}
```

### Paso 4: Build y deploy a Cloud Run
```bash
# Desde la raíz del proyecto
gcloud builds submit --config deploy/cloudbuild.yaml

# O si usás GitLab CI, hacer push a main → el pipeline lo despliega automáticamente
```

### Paso 5: Verificar Cloud Run
```bash
# Obtener URL del servicio
gcloud run services describe callmanager-orchestrator \
  --region=us-east1 \
  --format='value(status.url)'

# Probar health check
curl https://TU-URL.run.app/health
```

---

## PARTE 4 — Conectar FreeSWITCH al Orchestrator

### Actualizar vars.xml con la URL de Cloud Run
```bash
sudo nano /etc/freeswitch/vars.xml

# Cambiar:
# ORCHESTRATOR_URL_PLACEHOLDER
# por la URL real de Cloud Run:
# wss://callmanager-orchestrator-xxxxx-ue.a.run.app
```

### Recargar configuración de FreeSWITCH
```bash
sudo fs_cli -x "reloadxml"
sudo fs_cli -x "reload mod_audio_stream"
```

---

## PARTE 5 — Prueba End-to-End

### Test 1: Echo (verificar audio básico)
```bash
# Desde un teléfono SIP o softphone, marcar extensión 9999
# Deberías escuchar tu propio audio (echo test)
```

### Test 2: Bot IA (flujo completo)
```bash
# Marcar extensión 7000
# Deberías escuchar el saludo de Sofia (Google TTS)
# Hablar → el bot debería responder con Gemini
```

### Test 3: Escalamiento
```bash
# En la misma llamada, decir "quiero hablar con un agente"
# Verificar en Firestore que la sesión cambia a status: 'escalated'
# Verificar en Pub/Sub que llegó el mensaje de escalamiento
gcloud pubsub subscriptions pull call-escalations-sub --auto-ack --limit=5
```

---

## TROUBLESHOOTING

### FreeSWITCH no arranca
```bash
journalctl -u freeswitch -n 100 --no-pager
tail -f /var/log/freeswitch/freeswitch.log
```

### mod_audio_stream no carga
```bash
# Verificar que la librería está instalada
ls /usr/lib/freeswitch/mod/ | grep audio_stream
# Si no está: recompilar o revisar install.sh
```

### Orchestrator no conecta a FreeSWITCH ESL
```bash
# Verificar que el puerto 8021 es accesible desde Cloud Run via VPN
# En la VM FreeSWITCH:
sudo ss -tlnp | grep 8021
# Debe aparecer 0.0.0.0:8021
```

### STT no transcribe bien
```bash
# Verificar codec y sample rate en FreeSWITCH
sudo fs_cli -x "show codec"
# Debe incluir PCMU/8000
```
