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
# Standardized imports from root convo_bots/ directory
try:
    from supabase_utils import fetch_memory_concepts, fetch_workspace_files
    SUPABASE_UTILS_AVAILABLE = True
except ImportError:
    SUPABASE_UTILS_AVAILABLE = False
    logging.warning("supabase_utils.py not found")

try:
    from prompt_utils import build_enhanced_dialogue_prompt, format_message
    PROMPT_UTILS_AVAILABLE = True
except ImportError:
    PROMPT_UTILS_AVAILABLE = False
    logging.warning("prompt_utils.py not found")

try:
    from memory_graph import MemoryGraph
    MEMORY_AVAILABLE = True
except ImportError:
    MEMORY_AVAILABLE = False
    logging.warning("memory_graph.py not found")

# ── Torch / Transformers ─────────────────────────────────────────────────────
try:
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    logging.error("torch/transformers not installed")

# ── Config ────────────────────────────────────────────────────────────────────
MODEL_A_PATH  = os.getenv("MODEL_A_PATH", str(BASE_DIR.parent / "model_checkpoint_mauk_1"))
MODEL_B_PATH  = os.getenv("MODEL_B_PATH", str(BASE_DIR.parent / "model_checkpoint_abaci_1"))

BOT_A_NAME = os.getenv("BOT_A_NAME", "MAUK")
BOT_B_NAME = os.getenv("BOT_B_NAME", "ABACI")
USER_NAME  = os.getenv("USER_NAME",  "CORINA")

SETTINGS = {
    "temperature":        0.70,
    "top_p":              0.95,
    "repetition_penalty": 1.30,
    "max_new_tokens":     60,
}

# ── Device Setup ─────────────────────────────────────────────────────────────
if TORCH_AVAILABLE:
    DEVICE = torch.device("cpu") # Stability flip for Apple Silicon
else:
    DEVICE = None

# ── Model Management ──────────────────────────────────────────────────────────
models = {"a": None, "b": None}
tokenizers = {"a": None, "b": None}
load_status = {"a": "unloaded", "b": "unloaded"}
model_lock = threading.Lock()

def ensure_model(bot: str):
    """Load model lazily."""
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
        logging.info(f"Loading {bot} into RAM...")
        tokenizer = AutoTokenizer.from_pretrained(path)
        tokenizer.pad_token = tokenizer.eos_token
        
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
        logging.info(f"Bot {bot} READY.")
        return True
    except Exception as e:
        logging.error(f"Failed to load bot {bot}: {e}")
        load_status[bot] = "error"
        return False

# ── Dialogue Logic ────────────────────────────────────────────────────────────

def strip_dialogue_prefix(text: str, name: str) -> str:
    pattern = rf"^\s*\[{re.escape(name)}\]:\s*"
    text = re.sub(pattern, "", text, flags=re.IGNORECASE).strip()
    for other in [BOT_A_NAME, BOT_B_NAME, USER_NAME]:
        next_turn = text.find(f"[{other}]:")
        if next_turn != -1: text = text[:next_turn].strip()
    return text

def generate_response(bot: str, history: list[dict]) -> str:
    bot_name = BOT_A_NAME if bot == "a" else BOT_B_NAME
    
    demo_lines = {
        "a": ["the moon is an open set and I cannot find its boundary."],
        "b": ["let x be the colour of your silence. it converges."],
    }

    if not ensure_model(bot) or load_status[bot] != "ready":
        if load_status[bot] == "loading": return "(model warming up...)"
        import random
        return random.choice(demo_lines[bot])

    try:
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
        return "(silence)"

# ── Flask Endpoints ───────────────────────────────────────────────────────────

app = Flask(__name__)
CORS(app)

@app.route("/api/status")
def get_status():
    return jsonify({"status": "online", "load_status": load_status})

@app.route("/api/generate/<bot>", methods=["POST"])
def generate(bot):
    if bot not in ("a", "b"): abort(400)
    history = request.json.get("history", [])
    text = generate_response(bot, history)
    return jsonify({"speaker": BOT_A_NAME if bot == "a" else BOT_B_NAME, "text": text})

if __name__ == "__main__":
    # Auto-prime models in background to break the wait-loop with loop.py
    def prime():
        time.sleep(2)
        logging.info("Auto-priming models...")
        ensure_model("a")
        ensure_model("b")
    
    threading.Thread(target=prime, daemon=True).start()
    
    app.run(host="127.0.0.1", port=5001, debug=False)
