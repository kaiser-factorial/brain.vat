#!/bin/bash
# ==============================================================================
# BRAIN_VAT // IGNITION_SEQUENCE
# One-click macro to start all python endpoints, the conversation loop,
# and the local React frontend.
# ==============================================================================

BASE_DIR="/Users/corinakaiser/Desktop/brain.vat"

echo "Initializing Brain Vat architecture..."
echo "Cleaning up any old ghost processes..."
pkill -f "venv/bin/python server.py" || true
pkill -f "venv/bin/python loop.py" || true

# 1. Open the Inference Server in a new Matrix window
osascript -e "tell application \"Terminal\" to do script \"cd $BASE_DIR/convo_bots && venv/bin/python server.py\""

echo "Waiting for Flask server binding..."
sleep 3

# 2. Open the Autonomous Prompting Loop in a new window
osascript -e "tell application \"Terminal\" to do script \"cd $BASE_DIR/convo_bots && venv/bin/python loop.py\""
sleep 1

# 3. Open the Next.js Frontend Framework in a new window
osascript -e "tell application \"Terminal\" to do script \"cd $BASE_DIR/convo_bots/brain.vat_v0 && npm run dev\""

echo "Waiting for NodeJS router binding..."
sleep 4

# 4. Open Default Web Browser to the Admin Panel!
open "http://localhost:3000/admin"

echo "Ignition sequence complete. You may close this terminal window."
