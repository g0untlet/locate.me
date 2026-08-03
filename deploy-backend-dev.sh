#!/bin/bash

# ==========================================================================
# locate.me - Backend Deployment to DEV Server
# ==========================================================================

set -euo pipefail

# 1. Configuration & Target Paths
LOCAL_TARGET_DIR="./backend/target"
REMOTE_USER="gauntlet"
REMOTE_HOST="192.168.178.88"
REMOTE_TARGET_DIR="/home/gauntlet/homelab/locate.me.dev/backend/"

echo "===================================================="
echo "🚀 Starting Backend Deployment -> DEV Server"
echo "===================================================="

# 2. Local Sanity Checks & Dynamic JAR Selection
if [ ! -d "$LOCAL_TARGET_DIR" ]; then
    echo "❌ ERROR: Local directory '$LOCAL_TARGET_DIR' not found!"
    echo "Please execute this script from your project root (~/coding/locate.me)."
    echo "Also make sure you have built the application (e.g., ./mvn package)."
    exit 1
fi

# Count matching runner JAR files
JAR_COUNT=$(find "$LOCAL_TARGET_DIR" -maxdepth 1 -name "locator-service-*-runner.jar" | wc -l)

if [ "$JAR_COUNT" -eq 0 ]; then
    echo "❌ ERROR: No 'locator-service-*-runner.jar' found in '$LOCAL_TARGET_DIR'!"
    echo "Please build the project first."
    exit 1
elif [ "$JAR_COUNT" -gt 1 ]; then
    echo "❌ ERROR: Found $JAR_COUNT different runner JAR files in '$LOCAL_TARGET_DIR'!"
    echo "Please run './mvn clean' and rebuild to ensure only the latest JAR is deployed."
    exit 1
fi

# Single JAR found safely
LOCAL_JAR=$(find "$LOCAL_TARGET_DIR" -maxdepth 1 -name "locator-service-*-runner.jar")
JAR_FILENAME=$(basename "$LOCAL_JAR")

echo "📦 Found target artifact: $JAR_FILENAME"

# 3. Network Connectivity Check
echo "🔎 Checking connection to $REMOTE_HOST..."
if ! ping -c 1 -W 2 "$REMOTE_HOST" > /dev/null 2>&1; then
    echo "❌ ERROR: Server $REMOTE_HOST is unreachable on the network!"
    exit 1
fi

# 4. Cleanup old JARs on the Remote Server
echo "🧹 Cleaning up old runner JARs on DEV server..."
ssh "$REMOTE_USER@$REMOTE_HOST" "find '$REMOTE_TARGET_DIR' -maxdepth 1 -name 'locator-service-*-runner.jar' -delete"

# 5. File Synchronization via rsync
echo "🚚 Transferring $JAR_FILENAME via rsync..."
rsync -avz --progress \
  "$LOCAL_JAR" \
  "$REMOTE_USER@$REMOTE_HOST:$REMOTE_TARGET_DIR"

# Set permissions on server
echo "🔒 Adjusting permissions on remote server..."
ssh "$REMOTE_USER@$REMOTE_HOST" "chmod 644 '$REMOTE_TARGET_DIR/$JAR_FILENAME'"

echo "===================================================="
echo "✔ Backend successfully deployed to DEV!"
echo "===================================================="
echo "Notice: Remember to restart the DEV backend service if needed."

