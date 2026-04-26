#!/bin/bash
# =============================================================================
# install.sh — FreeSWITCH en Debian 12 para Call Manager AI
# Ejecutar como root: sudo bash install.sh
# =============================================================================

set -e

FREESWITCH_VERSION="1.10"
DOMAIN="callmanager.davivienda.local"   # Ajustar a tu dominio interno
SIP_PORT=5060
WEBSOCKET_PORT=5066          # Puerto WebSocket para JsSIP (agentes)
AUDIO_STREAM_PORT=8080       # Puerto WebSocket para streaming de audio al Orchestrator
ORCHESTRATOR_URL="wss://orchestrator-XXXX-uc.a.run.app"  # URL de tu Cloud Run

echo "============================================="
echo " FreeSWITCH Installer — Call Manager AI"
echo " Debian 12 — Davivienda"
echo "============================================="

# ── 1. DEPENDENCIAS DEL SISTEMA ──────────────────────────────────────────────
echo "[1/6] Instalando dependencias..."
apt-get update -qq
apt-get install -y \
  gnupg2 wget lsb-release curl \
  build-essential git \
  libtool autoconf automake \
  pkg-config

# ── 2. REPOSITORIO OFICIAL SIGNALWIRE (FreeSWITCH) ───────────────────────────
echo "[2/6] Configurando repositorio FreeSWITCH..."

# Token personal de SignalWire (gratis en https://id.signalwire.com)
# Exportar antes de ejecutar: export SIGNALWIRE_TOKEN=your_token
if [ -z "$SIGNALWIRE_TOKEN" ]; then
  echo "ERROR: Exportá tu token de SignalWire:"
  echo "  export SIGNALWIRE_TOKEN=tu_token"
  echo "  Registro gratis en https://id.signalwire.com"
  exit 1
fi

wget --http-user=signalwire \
     --http-password=$SIGNALWIRE_TOKEN \
     -O /usr/share/keyrings/signalwire-freeswitch-repo.gpg \
     https://freeswitch.signalwire.com/repo/deb/debian-release/signalwire-freeswitch-repo.gpg

echo "machine freeswitch.signalwire.com login signalwire password $SIGNALWIRE_TOKEN" \
  > /etc/apt/auth.conf.d/freeswitch.conf
chmod 600 /etc/apt/auth.conf.d/freeswitch.conf

echo "deb [signed-by=/usr/share/keyrings/signalwire-freeswitch-repo.gpg] \
  https://freeswitch.signalwire.com/repo/deb/debian-release/ bookworm main" \
  > /etc/apt/sources.list.d/freeswitch.list

apt-get update -qq

# ── 3. INSTALACIÓN FREESWITCH ─────────────────────────────────────────────────
echo "[3/6] Instalando FreeSWITCH..."
apt-get install -y \
  freeswitch \
  freeswitch-mod-console \
  freeswitch-mod-logfile \
  freeswitch-mod-sofia \
  freeswitch-mod-commands \
  freeswitch-mod-dptools \
  freeswitch-mod-dialplan-xml \
  freeswitch-mod-native-file \
  freeswitch-mod-sndfile \
  freeswitch-mod-tone-stream \
  freeswitch-mod-say-es \
  freeswitch-mod-say-en \
  freeswitch-mod-opus \
  freeswitch-mod-verto \
  freeswitch-mod-event-socket

# mod_audio_stream — para WebSocket streaming de audio al Orchestrator IA
# Compilar desde fuente (no está en paquetes oficiales aún)
echo "[3b] Compilando mod_audio_stream..."
apt-get install -y libwebsockets-dev freeswitch-dev
git clone https://github.com/nicholasgasior/mod_audio_stream.git /tmp/mod_audio_stream
cd /tmp/mod_audio_stream
make
make install
cd -

# ── 4. CONFIGURACIÓN BASE ─────────────────────────────────────────────────────
echo "[4/6] Aplicando configuración..."

FS_CONF="/etc/freeswitch"

# Hacer backup de la config por defecto
cp -r $FS_CONF ${FS_CONF}.bak.$(date +%Y%m%d)

# Copiar archivos de configuración del proyecto
cp freeswitch/vars.xml $FS_CONF/vars.xml
cp freeswitch/dialplan/default.xml $FS_CONF/dialplan/default.xml
cp freeswitch/autoload_configs/audio_stream.conf.xml \
   $FS_CONF/autoload_configs/audio_stream.conf.xml

# Reemplazar variables en configuración
sed -i "s|DOMAIN_PLACEHOLDER|$DOMAIN|g" $FS_CONF/vars.xml
sed -i "s|ORCHESTRATOR_URL_PLACEHOLDER|$ORCHESTRATOR_URL|g" $FS_CONF/vars.xml

# ── 5. HABILITAR MÓDULOS ──────────────────────────────────────────────────────
echo "[5/6] Habilitando módulos..."

# Agregar mod_audio_stream a modules.conf.xml
if ! grep -q "mod_audio_stream" $FS_CONF/autoload_configs/modules.conf.xml; then
  sed -i 's|</modules>|  <load module="mod_audio_stream"/>\n</modules>|' \
    $FS_CONF/autoload_configs/modules.conf.xml
fi

# ── 6. SYSTEMD Y ARRANQUE ─────────────────────────────────────────────────────
echo "[6/6] Configurando servicio..."

systemctl enable freeswitch
systemctl start freeswitch

sleep 3

if systemctl is-active --quiet freeswitch; then
  echo ""
  echo "✅ FreeSWITCH instalado y corriendo"
  echo ""
  echo "Próximos pasos:"
  echo "  1. Verificar: fs_cli -x 'status'"
  echo "  2. Ver logs:  tail -f /var/log/freeswitch/freeswitch.log"
  echo "  3. Testear ESL: fs_cli -x 'sofia status'"
  echo ""
  echo "Puertos:"
  echo "  SIP:       $SIP_PORT/UDP"
  echo "  WebSocket: $WEBSOCKET_PORT/TCP  (agentes JsSIP)"
  echo "  ESL:       8021/TCP             (Orchestrator)"
  echo "  Audio WS:  $AUDIO_STREAM_PORT/TCP (streaming IA)"
else
  echo "❌ Error: FreeSWITCH no arrancó. Revisar:"
  echo "  journalctl -u freeswitch -n 50"
fi
