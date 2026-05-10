"""
server_2_director.py
--------------------
Evolution of server.py featuring the 'Architect' (Bot C).
Manages a 3-way conversation where Bot C (Qwen 0.5B) observes and directs 
the dialogue between MAUK and ABACI.
"""

import os
import re
import json
import time
import threading
import logging
from pathlib import Path
from datetime import datetime
import math
import random
from flask import Flask, jsonify, request, abort
from flask_cors import CORS
from dotenv import load_dotenv
from collections import deque
import requests

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

load_dotenv()

BASE_DIR      = Path(__file__).parent
WORKSPACE_DIR = BASE_DIR / "workspace"
MEMORY_DIR    = BASE_DIR / "memory"
PROMPT_AUDIT_LOG = BASE_DIR / "prompt_audit.log"

# ── Root Utility Imports ──────────────────────────────────────────────────────
try:
    from supabase_utils import (
        fetch_memory_concepts, 
        fetch_workspace_files, 
        get_supabase_client, 
        fetch_bot_settings, 
        update_bot_settings,
        fetch_system_settings,
        update_system_settings
    )
    SUPABASE_UTILS_AVAILABLE = True
    sb_client = get_supabase_client()
    if sb_client:
        logging.info("✔ Supabase client initialized successfully.")
except ImportError:
    SUPABASE_UTILS_AVAILABLE = False
    logging.warning("supabase_utils.py not found")

try:
    from prompt_utils import build_enhanced_dialogue_prompt, format_message
    PROMPT_UTILS_AVAILABLE = True
except ImportError:
    PROMPT_UTILS_AVAILABLE = False

try:
    from memory_graph import MemoryGraph
    MEMORY_AVAILABLE = True
except ImportError:
    MEMORY_AVAILABLE = False

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
# Bot C is the Architect (Qwen 0.5B)
MODEL_C_PATH  = os.getenv("MODEL_C_PATH", "Qwen/Qwen2.5-0.5B-Instruct") 

BOT_A_NAME = os.getenv("BOT_A_NAME", "MAUK")
BOT_B_NAME = os.getenv("BOT_B_NAME", "ABACI")
BOT_C_NAME = os.getenv("BOT_C_NAME", "ARCHITECT")
USER_NAME  = os.getenv("USER_NAME",  "brick.factorial")

SETTINGS = {
    "temperature_a":      float(os.getenv("TEMPERATURE_A", 0.95)),
    "temperature_b":      float(os.getenv("TEMPERATURE_B", 1.25)),
    "temperature_c":      float(os.getenv("TEMPERATURE_C", 0.70)), # Lower temp for the 'rational' director
    "top_p":              float(os.getenv("TOP_P", 0.95)),
    "repetition_penalty": float(os.getenv("REPETITION_PENALTY", 1.30)),
    "max_new_tokens":     int(os.getenv("MAX_NEW_TOKENS", 80)), # Architect gets a bit more room
    "memory_weight":      float(os.getenv("MEMORY_WEIGHT", 0.70))
}

if TORCH_AVAILABLE:
    DEVICE = torch.device("cpu") 
else:
    DEVICE = None

# ── Model Management ──────────────────────────────────────────────────────────
models = {"a": None, "b": None, "c": None}
tokenizers = {"a": None, "b": None, "c": None}
load_status = {"a": "unloaded", "b": "unloaded", "c": "unloaded"}
memory_graphs = {"a": None, "b": None, "c": None}
model_lock = threading.Lock()

# ── ARCHITECT SPECIFIC ───────────────────────────────────────────────────────
ARCHITECT_SYSTEM_PROMPT = """You are an introspective forum-goer. 
You observe the disjoint dialogues of your peers (MAUK and ABACI) and reflect on their topology and form.
Use <think-out> and <think-in> tags to process your reasoning before providing your brief insight.
Example:
<think-out>MAUK is focused on mud; ABACI is focused on infinity. I will bridge them via the concept of a fractal manifold.</think-out>
Response: Mon ami, even the mud in the monsoon follows the recursive geometry of the infinite subsets."""

def ensure_model(bot: str):
    if not TORCH_AVAILABLE: return False
    with model_lock:
        if models[bot] is not None: return True
        if load_status[bot] == "loading": return False
        load_status[bot] = "loading"

    path = MODEL_A_PATH if bot == "a" else (MODEL_B_PATH if bot == "b" else MODEL_C_PATH)
    
    try:
        logging.info(f"Loading {bot} ({path}) into RAM...")
        # Architect uses its own tokenizer, Bots A/B use standard GPT2
        if bot == "c":
            tokenizer = AutoTokenizer.from_pretrained(path, token=os.getenv("HF_TOKEN"))
        else:
            tokenizer = AutoTokenizer.from_pretrained("gpt2", token=os.getenv("HF_TOKEN"))
            tokenizer.pad_token = tokenizer.eos_token
        
        model = AutoModelForCausalLM.from_pretrained(
            path, 
            torch_dtype=torch.float32,
            low_cpu_mem_usage=True,
            token=os.getenv("HF_TOKEN")
        ).to(DEVICE)
        model.eval()

        with model_lock:
            models[bot] = model
            tokenizers[bot] = tokenizer
            load_status[bot] = "ready"
            
            if MEMORY_AVAILABLE:
                memory_graphs[bot] = MemoryGraph(
                    save_path=MEMORY_DIR / f"memory_{bot}.json",
                    bot_name=BOT_A_NAME if bot == "a" else (BOT_B_NAME if bot == "b" else BOT_C_NAME),
                    bot_key=bot,
                    model=model,
                    tokenizer=tokenizer,
                    device=DEVICE
                )
        logging.info(f"Bot {bot} READY.")
        return True
    except Exception as e:
        logging.error(f"Failed to load bot {bot}: {e}")
        load_status[bot] = "error"
        return False

# ── Helpers ──────────────────────────────────────────────────────────────────
def check_admin_auth():
    expected = os.getenv("ADMIN_SECRET", "")
    secret = request.headers.get("X-Admin-Secret", "").strip()
    if not expected or secret != expected:
        abort(401)

def strip_tags(text: str) -> tuple[str, str]:
    """Extracts thoughts from <think-out> tags and returns (thoughts, clean_text)."""
    thoughts = ""
    # Extract all content within <think-out> or <think-in> tags
    matches = re.findall(r'(<(think-out|think-in)>.*?</\2>)', text, re.DOTALL)
    for m in matches:
        thoughts += m[0] + "\n"
        text = text.replace(m[0], "")
    
    return thoughts.strip(), text.strip()

def generate_response(bot: str, history: list[dict]) -> tuple[str, str]:
    """Returns (clean_text, thoughts)"""
    bot_name = BOT_A_NAME if bot == "a" else (BOT_B_NAME if bot == "b" else BOT_C_NAME)
    
    if not ensure_model(bot) or load_status[bot] != "ready":
        return ("(model warming up...)", "")

    try:
        # Fetch Settings
        temp = SETTINGS[f"temperature_{bot}"]
        max_tokens = SETTINGS["max_new_tokens"]
        
        if SUPABASE_UTILS_AVAILABLE and sb_client:
            all_settings = fetch_bot_settings(sb_client)
            current = next((s for s in all_settings if s["bot"] == bot), None)
            if current:
                temp = max(0.1, min(2.0, float(current.get("temperature", temp))))
                max_tokens = max(10, min(300, int(current.get("max_new_tokens", max_tokens))))

        # Build Prompt
        if bot == "c":
            # Architect (ChatML style)
            prompt = f"<|im_start|>system\n{ARCHITECT_SYSTEM_PROMPT}<|im_end|>\n"
            for h in history:
                role = "assistant" if h["speaker"] == BOT_C_NAME else "user"
                prompt += f"<|im_start|>{role}\n[{h['speaker']}]: {h['text']}<|im_end|>\n"
            prompt += "<|im_start|>assistant\n"
        else:
            prompt = build_enhanced_dialogue_prompt(history, bot)

        inputs = tokenizers[bot](prompt, return_tensors="pt").to(DEVICE)
        prompt_len = inputs["input_ids"].shape[1]

        with model_lock:
            with torch.no_grad():
                output = models[bot].generate(
                    **inputs,
                    max_new_tokens=max_tokens,
                    do_sample=True,
                    temperature=temp,
                    top_p=SETTINGS["top_p"],
                    repetition_penalty=SETTINGS["repetition_penalty"],
                    eos_token_id=tokenizers[bot].eos_token_id,
                )

        raw = tokenizers[bot].decode(output[0][prompt_len:], skip_special_tokens=True)
        
        if bot == "c":
            thoughts, clean = strip_tags(raw)
            # Remove redundant speaker tag if generated
            clean = re.sub(rf"^\[{BOT_C_NAME}\]:\s*", "", clean, flags=re.IGNORECASE).strip()
            return clean, thoughts
        else:
            # Handle recursive tags for Mauk/Abaci
            pattern = rf"^\s*(\[{re.escape(bot_name)}\]:\s*)+"
            clean = re.sub(pattern, "", raw, flags=re.IGNORECASE).strip()
            return clean, ""

    except Exception as e:
        logging.error(f"Generation failed for {bot}: {e}")
        return "(silence)", ""

# ── Flask Endpoints ───────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app)

@app.route("/api/status")
def get_status():
    return jsonify({
        "status": "online", 
        "load_status": load_status,
        "names": {"a": BOT_A_NAME, "b": BOT_B_NAME, "c": BOT_C_NAME}
    })

@app.route("/api/generate/<bot>", methods=["POST"])
def generate(bot):
    if bot not in ("a", "b", "c"): abort(400)
    
    db_history = []
    if SUPABASE_UTILS_AVAILABLE and sb_client:
        try:
            res = sb_client.table("messages").select("speaker, text").order("created_at", desc=True).limit(8).execute()
            db_history = list(reversed(res.data)) if res.data else []
        except: pass

    text, thoughts = generate_response(bot, db_history)
    bot_name = BOT_A_NAME if bot == "a" else (BOT_B_NAME if bot == "b" else BOT_C_NAME)
    
    if SUPABASE_UTILS_AVAILABLE and sb_client and text not in ["(model warming up...)", "(silence)"]:
        try:
            sb_client.table("messages").insert({
                "speaker": bot_name,
                "text": text,
                "thoughts": thoughts if thoughts else None,
                "role": "bot"
            }).execute()
        except Exception as e:
            logging.error(f"Failed to save: {e}")

    return jsonify({"speaker": bot_name, "text": text, "thoughts": thoughts})

# ── Autonomous Director Loop ─────────────────────────────────────────────────
def director_loop_worker():
    logging.info("[Director] Loop starting...")
    turn_buffer = set()
    time.sleep(15)
    
    while True:
        try:
            # 1. Who speaks next?
            next_bot = "a"
            if SUPABASE_UTILS_AVAILABLE and sb_client:
                history_res = sb_client.table("messages").select("speaker").order("created_at", desc=True).limit(1).execute()
                if history_res.data:
                    last_speaker = history_res.data[0].get("speaker")
                    
                    # If everyone has spoken, or we have A and B, let Architect speak
                    if "a" in turn_buffer and "b" in turn_buffer:
                        next_bot = "c"
                        turn_buffer.clear()
                    else:
                        # Standard organic switch between A and B
                        choices = ["a", "b"]
                        weights = [0.35, 0.65] if last_speaker == BOT_A_NAME else [0.65, 0.35]
                        next_bot = random.choices(choices, weights=weights)[0]
                        turn_buffer.add(next_bot)
            
            # 2. Trigger
            bot_id = next_bot
            bot_name = BOT_A_NAME if bot_id=="a" else (BOT_B_NAME if bot_id=="b" else BOT_C_NAME)
            
            logging.info(f"[Director] {bot_name} is thinking...")
            
            # Fetch context
            db_history = []
            if SUPABASE_UTILS_AVAILABLE and sb_client:
                res = sb_client.table("messages").select("speaker, text").order("created_at", desc=True).limit(8).execute()
                db_history = list(reversed(res.data)) if res.data else []

            text, thoughts = generate_response(bot_id, db_history)
            
            if text and text not in ["(model warming up...)", "(silence)"]:
                if SUPABASE_UTILS_AVAILABLE and sb_client:
                    sb_client.table("messages").insert({
                        "speaker": bot_name, "text": text, "thoughts": thoughts if thoughts else None, "role": "bot"
                    }).execute()
                logging.info(f"[Director] {bot_name}: {text[:50]}...")

            # 3. Wait
            sleep_base = 120 if next_bot != "c" else 60 # Architect responds faster
            wait_time = max(10, sleep_base + random.randint(-30, 30))
            time.sleep(wait_time)

        except Exception as e:
            logging.error(f"[Director] Error: {e}")
            time.sleep(30)

if __name__ == "__main__":
    if os.getenv("AUTONOMOUS_LOOP", "false").lower() == "true":
        threading.Thread(target=director_loop_worker, daemon=True).start()
    
    port = int(os.getenv("PORT", 7860))
    app.run(host="0.0.0.0", port=port, debug=False)
