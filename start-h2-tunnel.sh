#!/bin/bash

# Konfiguration
SERVER_IP="192.168.178.88"
SERVER_USER="gauntlet"
PORT="8082"
H2_JAR="/home/gauntlet/homelab/locate.me.dev/backend/h2-2.4.240.jar"

echo "=================================================="
echo " Öffne SSH-Tunnel und starte H2 Console..."
echo " Nach dem Start erreichbar unter: http://localhost:${PORT}"
echo " Beenden mit [Strg] + [C]"
echo "=================================================="

# SSH-Tunnel aufbauen und Befehl direkt auf dem Remote-Server ausführen
ssh -t -L 127.0.0.1:${PORT}:127.0.0.1:${PORT} ${SERVER_USER}@${SERVER_IP} \
  "java -cp ${H2_JAR} org.h2.tools.Server -web -webPort ${PORT} -webAllowOthers"
