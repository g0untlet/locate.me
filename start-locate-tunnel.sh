#!/bin/bash

# Konfiguration
SERVER_IP="192.168.178.88"
SERVER_USER="gauntlet"
LOCAL_PORT="8085"
REMOTE_PORT="8070"

echo "=================================================="
echo " Starte SSH-Tunnel für locate.me..."
echo " Lokaler Aufruf : http://localhost:${LOCAL_PORT}"
echo " Remote Ziel    : http://127.0.0.1:${REMOTE_PORT} auf ${SERVER_USER}@${SERVER_IP}"
echo " Beenden mit    : [Strg] + [C]"
echo "=================================================="

# Abfangen von Strg+C (SIGINT) für ein sauberes Beenden
trap 'echo -e "\n[+] Tunnel wird geschlossen..."; exit 0' SIGINT

# SSH-Tunnel ohne Befehlsausführung (-N) aufbauen
ssh -N -L ${LOCAL_PORT}:127.0.0.1:${REMOTE_PORT} ${SERVER_USER}@${SERVER_IP}

