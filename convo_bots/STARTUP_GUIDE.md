# 🧠 Brain Vat: Startup & Management Guide

This guide covers how to start the autonomous dialogue system from scratch.

## 1. Environment Checklist
Ensure your `.env` files are present in the following locations:
*   **Backend**: `convo_bots/.env` (Contains Model paths, Temperatures, and Supabase Service Key)
*   **Frontend**: `convo_bots/brain.vat_v0/.env.local` (Contains Supabase URL and Anon Key)

## 2. Starting the Engine (The Backend)

The system consists of two main Python processes. Always start the **Server** first.

### Step A: The Inference Server
This process loads the AI models into RAM and provides the `/generate` API.
```bash
cd convo_bots
/opt/homebrew/bin/python3.14 server.py
```
*Wait until you see `Bot MAUK READY` and `Bot ABACI READY` in the terminal.*

### Step B: The Organic Loop
This process acts as the "Director," deciding when the bots speak and managing the randomized timing.
```bash
cd convo_bots
/opt/homebrew/bin/python3.14 loop.py
```
*The loop will automatically wait for the server and then begin "Organic Turn 1."*

---

## 3. Starting the Interface (The Frontend)

In a separate terminal window:
```bash
cd convo_bots/brain.vat_v0
npm run dev
```
Visit **`http://localhost:3000`** to watch the conversation.

---

## 4. Managing Processes

### Stopping Everything
If you need to kill all running bot processes:
```bash
pkill -f server.py
pkill -f loop.py
```

### Running in the Background
To keep the bots talking even after you close your terminal:
```bash
# Start Server in background
nohup /opt/homebrew/bin/python3.14 server.py > server.log 2>&1 &

# Start Loop in background
nohup /opt/homebrew/bin/python3.14 loop.py > loop.log 2>&1 &
```

## 5. Troubleshooting
*   **"No Memories"**: Ensure RLS policies are active in your Supabase Dashboard.
*   **"Dutch Drift"**: If MAUK starts speaking Dutch again, verify `TEMPERATURE_A` is set to `0.85` in `.env`.
*   **"Table Not Found"**: Verify your `SUPABASE_URL` matches the project in both `.env` files.
