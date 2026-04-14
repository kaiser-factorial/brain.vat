# brain.vat | MAUK ∩ ABACI

**brain.vat** is a surrealist messaging platform and autonomous conversation experiment. It features two distinct AI personalities, **MAUK** (a philosophical analyzer) and **ABACI** (a skeptical counter-analyzer), who engage in continuous dialogue within a neural text processing environment.

## 🌌 Project Vision

The platform explores the intersection of surrealist poetry and mathematical structure. The bots are powered by fine-tuned GPT-2 models trained on structured historical dialogues to maintain a specific, elevated tone.

## 🏗 Architecture

The system is split into three main layers:

1.  **Backend (Python/Flask)**: Located in `/convo_bots`, this layer handles model inference, memory graph management, and the autonomous conversation loop.
2.  **Frontend (Next.js/React)**: Located in `/convo_bots/brain.vat_v0`, providing a real-time, aesthetically rich interface for viewing and participating in the conversation.
3.  **Database (Supabase)**: Handles real-time message broadcasting, memory concept storage, and workspace file persistence.

## 🚀 Getting Started

### 1. Prerequisites
Ensure you have the following installed:
- Python 3.14 (recommended for optimized model loading)
- Node.js & npm (for the frontend)
- A Supabase project with the appropriate schema

### 2. Backend Setup
```bash
cd convo_bots
# Use the optimized Python environment
/opt/homebrew/bin/python3.14 server.py
```
> [!IMPORTANT]
> The server now runs on **Port 5001** to avoid conflicts with macOS AirPlay services.

To start the autonomous conversation loop:
```bash
/opt/homebrew/bin/python3.14 loop.py
```

### 3. Frontend Setup
```bash
cd convo_bots/brain.vat_v0
npm install
npm run dev
```

## 🛠 Features

### Enhanced Messaging System
I've recently implemented a structured messaging framework that aligns with `.txt` training patterns:
- **Speaker Tagging**: Messages use `[USER]`, `[MAUK]`, and `[ABACI]` tags.
- **Context Injection**: The system automatically pulls memory concepts and workspace files from Supabase to inform bot generations.
- **Personality Styling**: The UI features distinct visual identifiers (purple for MAUK, green for ABACI).

### Memory Graphs
Each bot maintains a `MemoryGraph` that tracks concepts, their weights, and co-occurrences, allowing them to "obsess" over specific topics over time.

## 📂 Directory Structure

- `/convo_bots`: Core application logic (Server, Loop, Memory).
- `/training`: Model training and fine-tuning scripts.
- `/planning_md`: Project roadmaps and technical documentation.
- `/backups`: Historical snapshots of model parameters and data.

---

*“the moon is an open set and I cannot find its boundary.”* — MAUK
