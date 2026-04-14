"""
server.py
---------
High-stability Flask backend for MAUK and ABACI.
Standardized for root-level utility imports and CPU inference.
"""

import os
import re
import json
import time
import threading
import logging
from pathlib import Path
from datetime import datetime
from flask import Flask, jsonify, request, abort
from flask_cors import CORS
from dotenv import load_dotenv

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

load_dotenv()

BASE_DIR      = Path(__file__).parent
WORKSPACE_DIR = BASE_DIR / "workspace"
MEMORY_DIR    = BASE_DIR / "memory"

# ── Root Utility Imports ──────────────────────────────────────────────────────
# Utilities have been moved to the root to satisfy the IDE and stabilize runtime.
try:
    from supabase_utils import fetch_memory_concepts, fetch_workspace_files
    SUPABASE_UTILS_AVAILABLE = True
except ImportError:
    SUPABASE_UTILS_AVAILABLE = False
    logging.warning("supabase_utils.py not found — context disabled")

try:
    from prompt_utils import build_enhanced_dialogue_prompt, format_bot_message, format_user_message
    PROMPT_UTILS_AVAILABLE = True
except ImportError:
    PROMPT_UTILS_AVAILABLE = False
    logging.warning("prompt_utils.py not found — logic disabled")

try:
    from memory_graph import MemoryGraph
    MEMORY_AVAILABLE = True
except ImportError:
    MEMORY_AVAILABLE = False
    logging.warning("memory_graph.py not found — memory disabled")

# ── Torch / Transformers ─────────────────────────────────────────────────────
try:
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    logging.error("torch/transformers not installed — running in DEMO mode")

# ── Config ────────────────────────────────────────────────────────────────────
# Corrected model paths for mauk_1 and abaci_1
MODEL_A_PATH  = os.getenv("MODEL_A_PATH", str(BASE_DIR.parent / "model_checkpoint_mauk_1"))
MODEL_B_PATH  = os.getenv("MODEL_B_PATH", str(BASE_DIR.parent / "model_checkpoint_abaci_1"))

BOT_A_NAME = os.getenv("BOT_A_NAME", "MAUK")
BOT_B_NAME = os.getenv("BOT_B_NAME", "ABACI")
USER_NAME  = os.getenv("USER_NAME",  "CORINA")

# Standardized settings for stability
SETTINGS = {
    "temperature":        float(os.getenv("TEMPERATURE",        0.70)),
    "top_p":              float(os.getenv("TOP_P",              0.95)),
    "repetition_penalty": float(os.getenv("REPETITION_PENALTY", 1.30)),
    "max_new_tokens":     int(os.getenv("MAX_NEW_TOKENS",       60)),
    "context_turns":      int(os.getenv("CONTEXT_TURNS",        6)),
}

# ── Device Setup ─────────────────────────────────────────────────────────────
# Force CPU for stability on Apple Silicon with these GPT-2 checkpoints
if TORCH_AVAILABLE:
    DEVICE = torch.device("cpu")
    logging.info(f"Inference device forced to: {DEVICE}")
else:
    DEVICE = None

# ── Model Management ──────────────────────────────────────────────────────────
models = {"a": None, "b": None}
tokenizers = {"a": None, "b": None}
load_status = {"a": "unloaded", "b": "unloaded"}
model_lock = threading.Lock()

def ensure_model(bot: str):
    """Load model lazily and thread-safely."""
    if not TORCH_AVAILABLE: return False
    
    with model_lock:
        if models[bot] is not None: return True
        if load_status[bot] == "loading": return False
        load_status[bot] = "loading"

    path = MODEL_A_PATH if bot == "a" else MODEL_B_PATH
    if not os.path.exists(path):
        logging.error(f"Checkpoint not found: {path}")
        load_status[bot] = "demo"
        return False

    try:
        logging.info(f"Loading bot {bot} into RAM...")
        tokenizer = AutoTokenizer.from_pretrained(path)
        tokenizer.pad_token = tokenizer.eos_token
        
        # Force float32 for CPU stability
        model = AutoModelForCausalLM.from_pretrained(
            path, 
            torch_dtype=torch.float32,
            low_cpu_mem_usage=True
        ).to(DEVICE)
        model.eval()

        with model_lock:
            models[bot] = model
            tokenizers[bot] = tokenizer
            load_status[bot] = "ready"
        logging.info(f"Bot {bot} is READY.")
        return True
    except Exception as e:
        logging.error(f"Failed to load bot {bot}: {e}")
        load_status[bot] = "error"
        return False

# ── Dialogue Logic ────────────────────────────────────────────────────────────

def strip_dialogue_prefix(text: str, name: str) -> str:
    pattern = rf"^\s*\[{re.escape(name)}\]:\s*"
    text = re.sub(pattern, "", text, flags=re.IGNORECASE).strip()
    # Remove any leaked tokens or next turns
    for other in [BOT_A_NAME, BOT_B_NAME, USER_NAME]:
        next_turn = text.find(f"[{other}]:")
        if next_turn != -1:
            text = text[:next_turn].strip()
    return text

def generate_response(bot: str, history: list[dict]) -> str:
    bot_name = BOT_A_NAME if bot == "a" else BOT_B_NAME
    
    demo_lines = {
        "a": [
            "the moon is an open set and I cannot find its boundary.",
            "proof by contradiction: you exist, therefore I am undefined.",
            "topology of grief — no boundary, only accumulation points.",
        ],
        "b": [
            "let x be the colour of your silence. it converges.",
            "assume continuity. the proof breaks at the point of contact.",
            "the sequence of your words has no Cauchy subsequence.",
        ],
    }

    # Ensure model is ready before proceeding
    if not ensure_model(bot) or load_status[bot] != "ready":
        import random
        # If loading, wait briefly, otherwise return fallback
        if load_status[bot] == "loading": return "(model warming up...)"
        return random.choice(demo_lines[bot])

    try:
        # Build prompt using root-level prompt_utils
        prompt = build_enhanced_dialogue_prompt(history, bot)
        
        inputs = tokenizers[bot](prompt, return_tensors="pt").to(DEVICE)
        prompt_len = inputs["input_ids"].shape[1]

        with torch.no_grad():
            output = models[bot].generate(
                **inputs,
                max_new_tokens=SETTINGS["max_new_tokens"],
                do_sample=True,
                temperature=SETTINGS["temperature"],
                top_p=SETTINGS["top_p"],
                repetition_penalty=SETTINGS["repetition_penalty"],
                eos_token_id=tokenizers[bot].eos_token_id,
            )

        raw = tokenizers[bot].decode(output[0][prompt_len:], skip_special_tokens=True)
        return strip_dialogue_prefix(raw, bot_name)
    except Exception as e:
        logging.error(f"Generation failed: {e}")
        import random
        return random.choice(demo_lines[bot])

# ── Flask Endpoints ───────────────────────────────────────────────────────────

app = Flask(__name__)
CORS(app)

@app.route("/api/status")
def get_status():
    return jsonify({
        "status": "online",
        "load_status": load_status,
        "device": str(DEVICE)
    })

@app.route("/api/generate/<bot>", methods=["POST"])
def generate(bot):
    if bot not in ("a", "b"): abort(400)
    history = request.json.get("history", [])
    response_text = generate_response(bot, history)
    
    return jsonify({
        "speaker": BOT_A_NAME if bot == "a" else BOT_B_NAME,
        "text": response_text,
        "role": "bot"
    })

if __name__ == "__main__":
    # Ensure workspaces exist
    for space in ("bot_a", "bot_b", "shared"):
        (WORKSPACE_DIR / space).mkdir(parents=True, exist_ok=True)
    MEMORY_DIR.mkdir(parents=True, exist_ok=True)
    
    app.run(host="127.0.0.1", port=5001, debug=False)
