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
from collections import deque

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
# Standardized imports from root convo_bots/ directory
try:
    from supabase_utils import fetch_memory_concepts, fetch_workspace_files, get_supabase_client, fetch_bot_settings, update_bot_settings
    SUPABASE_UTILS_AVAILABLE = True
    sb_client = get_supabase_client()
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
USER_NAME  = os.getenv("USER_NAME",  "brick.factorial")

SETTINGS = {
    "temperature_a":      float(os.getenv("TEMPERATURE_A", 0.95)),
    "temperature_b":      float(os.getenv("TEMPERATURE_B", 1.25)),
    "top_p":              float(os.getenv("TOP_P", 0.95)),
    "repetition_penalty": float(os.getenv("REPETITION_PENALTY", 1.30)),
    "max_new_tokens":     int(os.getenv("MAX_NEW_TOKENS", 60)),
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
memory_graphs = {"a": None, "b": None}
model_lock = threading.Lock()

def is_loop_running():
    """Verify if the loop.py process is active via its PID file."""
    try:
        pid_file = BASE_DIR / "loop.pid"
        if not pid_file.exists(): return False
        with open(pid_file, "r") as f:
            pid = int(f.read().strip())
        os.kill(pid, 0) # Check if process exists
        return True
    except:
        return False

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
            
            # Initialize MemoryGraph for this bot now that model is ready
            if MEMORY_AVAILABLE:
                memory_graphs[bot] = MemoryGraph(
                    save_path=MEMORY_DIR / f"memory_{bot}.json",
                    bot_name=BOT_A_NAME if bot == "a" else BOT_B_NAME,
                    bot_key=bot,
                    model=model,
                    tokenizer=tokenizer,
                    device=DEVICE
                )

        logging.info(f"Bot {bot} READY (Memory pipeline linked).")
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

def log_prompt(bot: str, prompt: str, response: str):
    """Log the raw prompt and response for auditing."""
    try:
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "bot": bot,
            "bot_name": BOT_A_NAME if bot == "a" else BOT_B_NAME,
            "prompt": prompt,
            "response": response
        }
        with open(PROMPT_AUDIT_LOG, "a") as f:
            f.write(json.dumps(log_entry) + "\n")
    except Exception as e:
        logging.error(f"Failed to log prompt audit: {e}")

def generate_response(bot: str, history: list[dict]) -> str:
    bot_name = BOT_A_NAME if bot == "a" else BOT_B_NAME
    
    demo_lines = {
        "a": ["my inference is not functioning"],
        "b": ["my inference is not functioning"],
    }

    if not ensure_model(bot) or load_status[bot] != "ready":
        if load_status[bot] == "loading": return "(model warming up...)"
        import random
        return random.choice(demo_lines[bot])

    try:
        # FETCH SETTINGS from Supabase (Real-time override)
        bot_settings = {
            "temperature": SETTINGS["temperature_a"] if bot == "a" else SETTINGS["temperature_b"],
            "top_p": SETTINGS["top_p"],
            "banned_words": []
        }
        
        if SUPABASE_UTILS_AVAILABLE and sb_client:
            all_settings = fetch_bot_settings(sb_client)
            current = next((s for s in all_settings if s["bot"] == bot), None)
            if current:
                # SAFETY: Clip values to sane ranges to prevent inference crashes
                if current.get("temperature") is not None:
                    bot_settings["temperature"] = max(0.1, min(2.0, float(current["temperature"])))
                if current.get("top_p") is not None:
                    bot_settings["top_p"] = max(0.01, min(1.0, float(current["top_p"])))
                bot_settings["banned_words"] = current.get("banned_words", [])
                logging.info(f"Using DB settings for {bot_name}: {bot_settings}")

        prompt = build_enhanced_dialogue_prompt(history, bot)
        inputs = tokenizers[bot](prompt, return_tensors="pt").to(DEVICE)
        prompt_len = inputs["input_ids"].shape[1]

        # --- BANNED WORDS CACHING ---
        # Cache tokenized banned words to avoid redundant encoding on every turn
        cache_key = f"{bot}:{','.join(bot_settings['banned_words'])}"
        if not hasattr(generate_response, "_banned_cache"):
            generate_response._banned_cache = {}
        
        if cache_key in generate_response._banned_cache:
            final_bad_words = generate_response._banned_cache[cache_key]
        else:
            bad_words_ids = []
            eos_id = tokenizers[bot].eos_token_id
            for word in bot_settings["banned_words"]:
                if not word: continue
                ids = tokenizers[bot].encode(word, add_special_tokens=False)
                if ids:
                    # SAFETY: Never allow banning the EOS token (prevents infinite loops)
                    if len(ids) == 1 and ids[0] == eos_id:
                        continue
                    bad_words_ids.append(ids)
            
            final_bad_words = bad_words_ids if bad_words_ids else None
            generate_response._banned_cache[cache_key] = final_bad_words

        with torch.no_grad():
            output = models[bot].generate(
                **inputs,
                max_new_tokens=SETTINGS["max_new_tokens"],
                do_sample=True,
                temperature=bot_settings["temperature"],
                top_p=bot_settings["top_p"],
                repetition_penalty=SETTINGS["repetition_penalty"],
                bad_words_ids=final_bad_words,
                eos_token_id=tokenizers[bot].eos_token_id,
            )

        raw = tokenizers[bot].decode(output[0][prompt_len:], skip_special_tokens=True)
        response_text = strip_dialogue_prefix(raw, bot_name)
        
        # AUDIT: Log the interaction
        log_prompt(bot, prompt, response_text)
        
        return response_text
    except Exception as e:
        logging.error(f"Generation failed: {e}")
        return "(silence)"

# ── Flask Endpoints ───────────────────────────────────────────────────────────

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}}, allow_headers=["Content-Type", "X-Admin-Secret"])

@app.route("/api/status")
def get_status():
    return jsonify({
        "status": "online", 
        "loop_active": is_loop_running(),
        "load_status": load_status,
        "settings": SETTINGS,
        "names": {
            "a": BOT_A_NAME,
            "b": BOT_B_NAME
        }
    })

@app.route("/api/generate/<bot>", methods=["POST"])
def generate(bot):
    if bot not in ("a", "b"): abort(400)
    
    # Fetch context from Supabase to ensure bots are coherent
    db_history = []
    if SUPABASE_UTILS_AVAILABLE and sb_client:
        try:
            res = sb_client.table("messages").select("speaker, text").order("created_at", desc=True).limit(6).execute()
            db_history = list(reversed(res.data)) if res.data else []
        except Exception as e:
            logging.error(f"Failed to fetch context: {e}")

    # Generate the response
    text = generate_response(bot, db_history)
    bot_name = BOT_A_NAME if bot == "a" else BOT_B_NAME
    
    # PERSISTENCE: Save the response to Supabase
    if SUPABASE_UTILS_AVAILABLE and sb_client:
        try:
            sb_client.table("messages").insert({
                "speaker": bot_name,
                "text": text,
                "role": "bot"
            }).execute()
            logging.info(f"Message from {bot_name} saved to Supabase.")
        except Exception as e:
            logging.error(f"Failed to save message: {e}")

    # CURATION: Process memory in background
    if MEMORY_AVAILABLE and memory_graphs[bot]:
        def curate_task(txt, g):
            try:
                concepts = g.curate_and_remember(txt)
                if concepts:
                    logging.info(f"Memory archived for {bot_name}: {concepts}")
            except Exception as e:
                logging.error(f"Memory curation failed for {bot_name}: {e}")
        
        threading.Thread(target=curate_task, args=(text, memory_graphs[bot]), daemon=True).start()

    return jsonify({"speaker": bot_name, "text": text})

@app.route("/api/admin/settings", methods=["GET", "POST"])
def admin_settings():
    # Security: Strict ADMIN_SECRET check
    expected = os.getenv("ADMIN_SECRET")
    secret = request.headers.get("X-Admin-Secret")
    
    if not expected or secret != expected:
        abort(401)
        
    if not SUPABASE_UTILS_AVAILABLE or not sb_client:
        return jsonify({"error": "Supabase unavailable"}), 503
    
    if request.method == "POST":
        data = request.json
        bot = data.get("bot")
        if bot not in ("a", "b"): abort(400)
        
        # Strip internal keys from settings
        settings = {
            "temperature": data.get("temperature"),
            "top_p": data.get("top_p"),
            "banned_words": data.get("banned_words", [])
        }
        
        success = update_bot_settings(sb_client, bot, settings)
        if success:
            return jsonify({"status": "success"})
        return jsonify({"status": "error"}), 500

    # GET
    settings = fetch_bot_settings(sb_client)
    return jsonify(settings)

@app.route("/api/admin/audit")
def get_audit_logs():
    """Retrieve prompt audit logs for the secret dashboard efficiently."""
    # Security: Strict ADMIN_SECRET check
    expected = os.getenv("ADMIN_SECRET")
    secret = request.headers.get("X-Admin-Secret")
    
    if not expected or secret != expected:
        abort(401)
        
    try:
        if not PROMPT_AUDIT_LOG.exists():
            return jsonify([])
        
        # Memory-efficient read of the last 50 lines
        with open(PROMPT_AUDIT_LOG, "r") as f:
            last_lines = deque(f, 50)
            
        logs = []
        for line in last_lines:
            if not line.strip(): continue
            try:
                logs.append(json.loads(line))
            except (json.JSONDecodeError, ValueError):
                # Skip corrupted or partial lines gracefully
                continue
        return jsonify(logs)
    except Exception as e:
        logging.error(f"Audit fetch failed: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/memory/source/<bot>/<concept>")
def get_memory_source(bot, concept):
    """Fetch the original dialogue that created a specific concept."""
    if bot not in ("a", "b"): abort(400)
    if not SUPABASE_UTILS_AVAILABLE or not sb_client:
        return jsonify({"source_text": "(Source unavailable — offline mode)"})
    
    try:
        # Fetch from the persistent archive
        res = sb_client.table("memory_archive") \
            .select("source_text") \
            .eq("bot", bot) \
            .eq("concept", concept) \
            .execute()
        
        if res.data and res.data[0].get("source_text"):
            return jsonify({"source_text": res.data[0]["source_text"]})
        return jsonify({"source_text": "(Context lost to time)"})
    except Exception as e:
        logging.error(f"Failed to fetch memory source: {e}")
        return jsonify({"source_text": "(Error retrieving context)"})

@app.route("/api/memory/archive")
def get_memory_archive():
    """Fetch the full historical memory archive for both bots."""
    if not SUPABASE_UTILS_AVAILABLE or not sb_client:
        return jsonify([])
    
    try:
        res = sb_client.table("memory_archive") \
            .select("*") \
            .order("last_thought_at", desc=True) \
            .execute()
        return jsonify(res.data or [])
    except Exception as e:
        logging.error(f"Failed to fetch archive: {e}")
        return jsonify([])

if __name__ == "__main__":
    # Auto-prime models in background to break the wait-loop with loop.py
    def prime():
        time.sleep(2)
        logging.info("Auto-priming models...")
        ensure_model("a")
        ensure_model("b")
    
    threading.Thread(target=prime, daemon=True).start()
    
    app.run(host="0.0.0.0", port=5001, debug=False)
