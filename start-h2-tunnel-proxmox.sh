#!/bin/bash

# Konfiguration
SERVER_IP="192.168.178.196"
SERVER_USER="gauntlet"
PORT="8082"
H2_JAR="/opt/locateme/dev/backend/h2-2.4.240.jar"

echo "=================================================="
echo " Öffne SSH-Tunnel und starte H2 Console..."
echo " Nach dem Start erreichbar unter: http://localhost:${PORT}"
echo " Beenden mit [Strg] + [C]"
echo "=================================================="

# NEU: Sorgt dafür, dass beim Beenden (STRG+C) auch der Remote-Java-Prozess stirbt
trap 'echo -e "\nBeende Tunnel und H2-Server..."; kill 0' SIGINT SIGTERM EXIT

# SSH-Tunnel aufbauen und Befehl direkt auf dem Remote-Server ausführen
ssh -t -L 127.0.0.1:${PORT}:127.0.0.1:${PORT} ${SERVER_USER}@${SERVER_IP} \
  "java -cp ${H2_JAR} org.h2.tools.Server -web -webPort ${PORT} -webAllowOthers"

