#!/bin/bash

# ==========================================================================
# locate.me - Website Deployment to DEV Server
# Deploys ./website to a dedicated folder next to the frontend so the
# app (frontend/backend) is never touched.
# ==========================================================================

set -euo pipefail

# 1. Configuration & Target Paths
LOCAL_WEBSITE_DIR="./website"
REMOTE_USER="gauntlet"
REMOTE_HOST="192.168.178.88"
REMOTE_APP_DIR="/home/gauntlet/homelab/locate.me.dev"
REMOTE_TARGET_DIR="$REMOTE_APP_DIR/website/"

SAFETY_DIR_NAME="website"

echo "===================================================="
echo "🌐 Starting Website Deployment -> DEV Server"
echo "===================================================="

# 2. Local Sanity Checks
if [ ! -d "$LOCAL_WEBSITE_DIR" ]; then
    echo "❌ ERROR: Local directory '$LOCAL_WEBSITE_DIR' not found!"
    echo "Please execute this script from your project root (~/coding/locate.me)."
    exit 1
fi

if [ ! -f "$LOCAL_WEBSITE_DIR/index.html" ] || [ ! -f "$LOCAL_WEBSITE_DIR/index.de.html" ]; then
    echo "❌ ERROR: 'index.html' / 'index.de.html' missing in '$LOCAL_WEBSITE_DIR'!"
    exit 1
fi

# 3. Safety Guard: ensure both sides point to a dedicated 'website' dir
if [ "$(basename "$LOCAL_WEBSITE_DIR")" != "$SAFETY_DIR_NAME" ]; then
    echo "❌ ERROR: Local dir must be named '$SAFETY_DIR_NAME' (got: $(basename "$LOCAL_WEBSITE_DIR"))."
    exit 1
fi

if [ "$(basename "$REMOTE_TARGET_DIR")" != "$SAFETY_DIR_NAME" ]; then
    echo "❌ ERROR: Remote target must be a dedicated '$SAFETY_DIR_NAME' folder (got: $REMOTE_TARGET_DIR)."
    exit 1
fi

if [ "$REMOTE_TARGET_DIR" = "$REMOTE_APP_DIR/" ]; then
    echo "❌ ERROR: Refusing to deploy directly into the app root '$REMOTE_APP_DIR'."
    exit 1
fi

if [ "$REMOTE_TARGET_DIR" = "$REMOTE_APP_DIR/frontend/" ]; then
    echo "❌ ERROR: Refusing to deploy into the frontend folder '$REMOTE_APP_DIR/frontend/'."
    exit 1
fi

# 4. Network Connectivity Check
echo "🔎 Checking connection to $REMOTE_HOST..."
if ! ping -c 1 -W 2 "$REMOTE_HOST" > /dev/null 2>&1; then
    echo "❌ ERROR: Server $REMOTE_HOST is unreachable on the network!"
    exit 1
fi

# 5. File Synchronization via rsync
echo "🚚 Synchronizing files via rsync..."
echo "   Local : $LOCAL_WEBSITE_DIR/"
echo "   Target: $REMOTE_USER@$REMOTE_HOST:$REMOTE_TARGET_DIR"

# Flag breakdown:
# -a : Archive mode (preserves permissions, modification times, etc.)
# -v : Verbose output
# -z : Compress file data during transfer for speed
# --delete : Removes obsolete files from the dedicated 'website' folder (safe; dir is not shared with the app)
# --delay-updates : Avoids partial updates on the server
rsync -avz --delete --delay-updates \
  --exclude='.git*' \
  --exclude='.DS_Store' \
  --exclude='*.tmp' \
  "$LOCAL_WEBSITE_DIR/" \
  "$REMOTE_USER@$REMOTE_HOST:$REMOTE_TARGET_DIR"

echo "===================================================="
echo "✔ Website successfully deployed to DEV!"
echo "===================================================="