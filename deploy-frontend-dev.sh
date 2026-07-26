#!/bin/bash

# ==========================================================================
# locate.me - Frontend Deployment to DEV Server
# ==========================================================================

set -euo pipefail

# 1. Configuration & Target Paths
LOCAL_FRONTEND_DIR="./frontend"
REMOTE_USER="gauntlet"
REMOTE_HOST="192.168.178.88"
REMOTE_TARGET_DIR="/home/gauntlet/homelab/locate.me.dev/frontend/"

echo "===================================================="
echo "🚀 Starting Frontend Deployment -> DEV Server"
echo "===================================================="

# 2. Local Sanity Checks
if [ ! -d "$LOCAL_FRONTEND_DIR" ]; then
    echo "❌ ERROR: Local directory '$LOCAL_FRONTEND_DIR' not found!"
    echo "Please execute this script from your project root (~/coding/locate.me)."
    exit 1
fi

if [ ! -f "$LOCAL_FRONTEND_DIR/index.html" ]; then
    echo "❌ ERROR: 'index.html' missing in '$LOCAL_FRONTEND_DIR'!"
    exit 1
fi

# 3. Network Connectivity Check
echo "🔎 Checking connection to $REMOTE_HOST..."
if ! ping -c 1 -W 2 "$REMOTE_HOST" > /dev/null 2>&1; then
    echo "❌ ERROR: Server $REMOTE_HOST is unreachable on the network!"
    exit 1
fi

# 4. File Synchronization via rsync
echo "🚚 Synchronizing files via rsync..."

# Flag breakdown:
# -a : Archive mode (preserves permissions, modification times, etc.)
# -v : Verbose output
# -z : Compress file data during transfer for speed
# --delete : Removes obsolete files on the server that no longer exist locally
# --exclude : Prevents uploading unnecessary developer or system files
# --delay-updates : Stashes transferred files until upload completes, avoiding partial updates

rsync -avz --delete --delay-updates \
  --exclude='.git*' \
  --exclude='.DS_Store' \
  --exclude='*.tmp' \
  "$LOCAL_FRONTEND_DIR/" \
  "$REMOTE_USER@$REMOTE_HOST:$REMOTE_TARGET_DIR"

echo "===================================================="
echo "✔ Frontend successfully deployed to DEV!"
echo "===================================================="

