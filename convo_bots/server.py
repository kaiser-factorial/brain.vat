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
# Standardized imports from root convo_bots/ directory
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
    else:
        logging.warning("✖ Supabase client FAILED to initialize. Check if SUPABASE_URL and SUPABASE_SERVICE_KEY are set in Secrets.")
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

# ── Helpers ──────────────────────────────────────────────────────────────────

def safe_float(val, default):
    """Safely convert value to float, handling NaN/Inf and malformed inputs."""
    try:
        if val is None: return default
        f = float(val)
        if math.isnan(f) or math.isinf(f):
            return default
        return f
    except (ValueError, TypeError):
        return default

def safe_int(val, default):
    """Safely convert value to int."""
    try:
        if val is None: return default
        # Handle float strings being cast to int
        return int(float(val))
    except (ValueError, TypeError):
        return default

# ── Config ────────────────────────────────────────────────────────────────────
MODEL_A_PATH  = os.getenv("MODEL_A_PATH", str(BASE_DIR.parent / "model_checkpoint_mauk_1"))
MODEL_B_PATH  = os.getenv("MODEL_B_PATH", str(BASE_DIR.parent / "model_checkpoint_abaci_1"))
MODEL_C_PATH  = os.getenv("MODEL_C_PATH", "brick-factorial/archie-v1")
MODEL_D_PATH  = os.getenv("MODEL_D_PATH", "")  # e.g. talkie-lm/talkie-1930-13b-instruct

BOT_A_NAME = os.getenv("BOT_A_NAME", "MAUK")
BOT_B_NAME = os.getenv("BOT_B_NAME", "ABACI")
BOT_C_NAME = os.getenv("BOT_C_NAME", "ARCHIE")
BOT_D_NAME = os.getenv("BOT_D_NAME", "TALKIE")
USER_NAME  = os.getenv("USER_NAME",  "brick.factorial")

SETTINGS = {
    "temperature_a":      float(os.getenv("TEMPERATURE_A", 0.95)),
    "temperature_b":      float(os.getenv("TEMPERATURE_B", 1.25)),
    "temperature_c":      float(os.getenv("TEMPERATURE_C", 0.90)),
    "temperature_d":      float(os.getenv("TEMPERATURE_D", 0.90)),
    "top_p":              float(os.getenv("TOP_P", 0.95)),
    "repetition_penalty": float(os.getenv("REPETITION_PENALTY", 1.30)),
    "max_new_tokens":     int(os.getenv("MAX_NEW_TOKENS", 60)),
    "top_k":              int(os.getenv("TOP_K", 0)),
    "memory_weight":      float(os.getenv("MEMORY_WEIGHT", 0.70))
}

# ── Device Setup ─────────────────────────────────────────────────────────────
if TORCH_AVAILABLE:
    DEVICE = torch.device("cpu") # Stability flip for Apple Silicon
else:
    DEVICE = None

# ── Model Management ──────────────────────────────────────────────────────────
models = {"a": None, "b": None, "c": None, "d": None}
tokenizers = {"a": None, "b": None, "c": None, "d": None}
load_status = {"a": "unloaded", "b": "unloaded", "c": "unloaded", "d": "unloaded"}
memory_graphs = {"a": None, "b": None, "c": None, "d": None}
model_lock = threading.Lock()
logging_lock = threading.Lock()
cache_lock = threading.Lock()

# Pause state (in-memory for safe-default behavior on crash)
LOOP_PAUSES = {"a": False, "b": False, "c": False, "d": False}

def get_loop_status():
    """Verify which loop processes are active via their specific PID files or Cloud Thread."""
    results = {"a": False, "b": False, "unified": False}
    
    # If we are in the Cloud/Integrated mode, the loop is always "unified" if enabled
    if os.getenv("AUTONOMOUS_LOOP", "false").lower() == "true":
        results["unified"] = True
        return results

    pid_files = {
        "a": BASE_DIR / "loop_a.pid",
        "b": BASE_DIR / "loop_b.pid",
        "unified": BASE_DIR / "loop_unified.pid"
    }
    
    for key, path in pid_files.items():
        if path.exists():
            try:
                with open(path, "r") as f:
                    pid = int(f.read().strip())
                os.kill(pid, 0)
                results[key] = True
            except (ValueError, ProcessLookupError, PermissionError):
                # PID file is stale or unreadable
                pass
            except Exception:
                pass
    return results

def is_loop_running():
    """Fallback for any active loop."""
    status = get_loop_status()
    return any(status.values())

def ensure_model(bot: str):
    """Load model lazily."""
    if not TORCH_AVAILABLE: return False
    
    with model_lock:
        if models[bot] is not None: return True
        if load_status[bot] == "loading": return False
        load_status[bot] = "loading"

    _paths = {"a": MODEL_A_PATH, "b": MODEL_B_PATH, "c": MODEL_C_PATH, "d": MODEL_D_PATH}
    path = _paths.get(bot, "")
    if not path:
        logging.warning(f"[{bot}] No model path configured — skipping load")
        load_status[bot] = "demo"
        return False
    # Only fail if it's not a local path AND doesn't look like a Hugging Face repo ID
    if not os.path.exists(path) and "/" not in path:
        logging.error(f"Checkpoint not found: {path}")
        load_status[bot] = "demo"
        return False

    try:
        logging.info(f"[{bot}] Initializing models and tokenizer from: {path}")
        # IMPORTANT: We load the model-specific tokenizer to support custom <think> tokens!
        def _hf_load(p, force=False):
            kw = dict(trust_remote_code=True, force_download=force)
            tok = AutoTokenizer.from_pretrained(p, **kw)
            mdl = AutoModelForCausalLM.from_pretrained(p, **kw)
            return tok, mdl

        try:
            tokenizers[bot], _mdl = _hf_load(path)
        except Exception as _cache_err:
            if any(k in str(_cache_err) for k in ("ModelWrapper", "untagged enum", "safetensor", "HeaderToo")):
                logging.warning(f"[{bot}] Corrupt cache detected — forcing re-download from {path}")
                tokenizers[bot], _mdl = _hf_load(path, force=True)
            else:
                raise

        # Ensure special tokens are recognized
        if "<think>" not in tokenizers[bot].get_vocab():
            tokenizers[bot].add_special_tokens({"additional_special_tokens": ["<think>", "</think>"]})

        models[bot] = _mdl.to(DEVICE)
        
        # Sync model version to Supabase if available
        if SUPABASE_UTILS_AVAILABLE and sb_client:
            version_str = path.split("_")[-1] if "_" in path else "v1"
            try:
                update_bot_settings(sb_client, bot, {"model_version": version_str})
                logging.info(f"[{bot}] Successfully synced model_version to {version_str}")
            except Exception as db_err:
                logging.error(f"[{bot}] Failed to sync version to DB: {db_err}")
                
        load_status[bot] = "ready"
        
        # Initialize MemoryGraph for this bot now that model is ready
        if MEMORY_AVAILABLE:
            _names = {"a": BOT_A_NAME, "b": BOT_B_NAME, "c": BOT_C_NAME, "d": BOT_D_NAME}
            memory_graphs[bot] = MemoryGraph(
                save_path=MEMORY_DIR / f"memory_{bot}.json",
                bot_name=_names.get(bot, bot),
                bot_key=bot,
                model=models[bot],
                tokenizer=tokenizers[bot],
                device=DEVICE
            )

        logging.info(f"Bot {bot} READY (Memory pipeline linked).")
        return True
    except Exception as e:
        logging.error(f"Failed to load bot {bot}: {e}")
        load_status[bot] = "error"
        return False

# ── Locks ────────────────────────────────────────────────────────────────────
model_lock = threading.Lock()
logging_lock = threading.Lock()

# ── Helpers ──────────────────────────────────────────────────────────────────
def check_admin_auth():
    """Verify the X-Admin-Secret header against environment or fallback."""
    expected = os.getenv("ADMIN_SECRET", "")
    secret = request.headers.get("X-Admin-Secret", "").strip()
    if not expected or secret != expected:
        abort(401)

def strip_dialogue_prefix(text: str, name: str) -> str:
    # Handle recursive tags: [MAUK]: [MAUK]: hello -> hello
    pattern = rf"^\s*(\[{re.escape(name)}\]:\s*)+"
    text = re.sub(pattern, "", text, flags=re.IGNORECASE).strip()
    for other in [BOT_A_NAME, BOT_B_NAME, USER_NAME]:
        next_turn = text.find(f"[{other}]:")
        if next_turn != -1: text = text[:next_turn].strip()
    return text

def log_prompt(bot: str, prompt: str, response: str, settings: dict = None, memory_trace: str = None, suppressor_log: list = None):
    """Log the raw prompt and response for auditing with thread-safety."""
    try:
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "bot": bot,
            "bot_name": BOT_A_NAME if bot == "a" else BOT_B_NAME,
            "settings": settings.copy() if settings else {},
            "prompt": prompt,
            "response": response,
            "memory_trace": memory_trace,
            "suppressor_log": suppressor_log or []
        }
        with logging_lock:
            with open(PROMPT_AUDIT_LOG, "a") as f:
                f.write(json.dumps(log_entry) + "\n")
    except Exception as e:
        logging.error(f"Failed to log prompt audit: {e}")

def generate_response(bot: str, history: list[dict]) -> str:
    _bot_names = {"a": BOT_A_NAME, "b": BOT_B_NAME, "c": BOT_C_NAME, "d": BOT_D_NAME}
    bot_name = _bot_names.get(bot, bot)
    
    demo_lines = {
        "a": ["my inference is not functioning"],
        "b": ["my inference is not functioning"],
        "c": ["my inference is not functioning"],
        "d": ["my inference is not functioning"],
    }

    if not ensure_model(bot) or load_status[bot] != "ready":
        if load_status[bot] == "loading": return "(model warming up...)"
        import random
        return random.choice(demo_lines.get(bot, ["(silence)"]))

    try:
        # FETCH SETTINGS from Supabase (Real-time override)
        bot_settings = {
            "temperature": SETTINGS.get(f"temperature_{bot}", SETTINGS["temperature_a"]),
            "top_p": SETTINGS["top_p"],
            "repetition_penalty": SETTINGS["repetition_penalty"],
            "max_new_tokens": SETTINGS["max_new_tokens"],
            "top_k": SETTINGS["top_k"],
            "memory_weight": SETTINGS["memory_weight"],
            "banned_words": [],
            "model_version": "v1",
            "base_sleep": 40,
            "base_jitter": 15
        }
        
        if SUPABASE_UTILS_AVAILABLE and sb_client:
            all_settings = fetch_bot_settings(sb_client)
            current = next((s for s in all_settings if s["bot"] == bot), None)
            if current:
                # SAFETY: Clip values to sane ranges to prevent inference crashes
                if current.get("temperature") is not None:
                    parsed_temp = safe_float(current.get("temperature"), bot_settings["temperature"])
                    bot_settings["temperature"] = max(0.1, min(2.0, parsed_temp))
                    
                if current.get("top_p") is not None:
                    parsed_p = safe_float(current.get("top_p"), bot_settings["top_p"])
                    bot_settings["top_p"] = max(0.01, min(1.0, parsed_p))
                
                # Expand h-params
                if current.get("repetition_penalty") is not None:
                    parsed_pen = safe_float(current.get("repetition_penalty"), SETTINGS["repetition_penalty"])
                    bot_settings["repetition_penalty"] = max(1.0, min(2.5, parsed_pen))
                    
                if current.get("top_k") is not None:
                    bot_settings["top_k"] = safe_int(current.get("top_k"), SETTINGS["top_k"])
                    
                if current.get("max_new_tokens") is not None:
                    parsed_max = safe_int(current.get("max_new_tokens"), SETTINGS["max_new_tokens"])
                    bot_settings["max_new_tokens"] = max(10, min(200, parsed_max))

                if current.get("memory_weight") is not None:
                    parsed_mw = safe_float(current.get("memory_weight"), bot_settings["memory_weight"])
                    bot_settings["memory_weight"] = max(0.01, min(1.0, parsed_mw))
                
                bot_settings["banned_words"] = current.get("banned_words", [])
                bot_settings["model_version"] = current.get("model_version", "v1")
                bot_settings["base_sleep"] = current.get("base_sleep", 120)
                bot_settings["base_jitter"] = current.get("base_jitter", 30)
                logging.info(f"Using DB settings for {bot_name}: {bot_settings}")
            else:
                # Fallback to .env defaults if not in DB
                bot_settings["repetition_penalty"] = SETTINGS["repetition_penalty"]
                bot_settings["max_new_tokens"] = SETTINGS["max_new_tokens"]
        else:
            bot_settings["repetition_penalty"] = SETTINGS["repetition_penalty"]
            bot_settings["max_new_tokens"] = SETTINGS["max_new_tokens"]

        # --- PROMPT BUILDING ---
        # Detect whether the model uses a chat template (e.g. Qwen/instruction-tuned)
        # or expects raw completion (e.g. MAUK/ABACI GPT-2 style).
        use_chat_template = bool(getattr(tokenizers[bot], "chat_template", None))

        if use_chat_template:
            # Build a structured chat for instruction-tuned models (Qwen, Llama-Instruct, etc.)
            # Gather recent turns as proper role messages
            recent = history[-(4):] if history else []
            chat_messages = []
            if bot_settings.get("system_prompt"):
                chat_messages.append({"role": "system", "content": bot_settings["system_prompt"]})
            for msg in recent:
                speaker = msg.get("speaker", "")
                text = msg.get("text", "").strip().replace("\n", " ")
                role = "assistant" if speaker == bot_name else "user"
                chat_messages.append({"role": role, "content": f"[{speaker}]: {text}"})
            # If last message is already from assistant, add a nudge so model continues
            if chat_messages and chat_messages[-1]["role"] == "assistant":
                chat_messages.append({"role": "user", "content": f"[continue as {bot_name}]"})
            inputs = tokenizers[bot].apply_chat_template(
                chat_messages,
                tokenize=True,
                add_generation_prompt=True,
                return_tensors="pt",
            ).to(DEVICE)
            prompt = str(chat_messages)  # for audit log only
        else:
            # Raw completion path for GPT-2 style fine-tuned models
            prompt = build_enhanced_dialogue_prompt(history, bot)

            # --- MEMORY RETRIEVAL (Trace) ---
            memory_trace = None
            if MEMORY_AVAILABLE and memory_graphs[bot]:
                prompt, memory_trace = memory_graphs[bot].prompt_injection(prompt, blend_weight=bot_settings["memory_weight"])
                if memory_trace:
                    logging.info(f"[{bot_name}] Memory Trace: Recalled '{memory_trace}'")

            inputs = tokenizers[bot](prompt, return_tensors="pt").to(DEVICE)

        # prompt_len used to strip the prompt tokens from the output
        if isinstance(inputs, dict) or hasattr(inputs, "input_ids"):
            prompt_len = inputs["input_ids"].shape[1]
        else:
            # apply_chat_template with return_tensors returns a tensor directly
            prompt_len = inputs.shape[1]
            inputs = {"input_ids": inputs}

        # Set memory_trace for audit (chat template path skips memory for now)
        if use_chat_template:
            memory_trace = None

        # --- BANNED WORDS CACHING ---
        clean_words = sorted([w.strip() for w in bot_settings["banned_words"] if w.strip()])
        cache_key = f"{bot}:{','.join(clean_words)}"
        
        with cache_lock:
            if not hasattr(generate_response, "_banned_cache"):
                generate_response._banned_cache = {}
            
            cached_val = generate_response._banned_cache.get(cache_key)
            if cached_val is not None:
                final_bad_words = cached_val
            else:
                bad_words_ids = []
                eos_id = tokenizers[bot].eos_token_id
                
                for raw_word in clean_words:
                    word_variations = {
                        raw_word.lower(), raw_word.title(), raw_word.upper()
                    }
                    for word in word_variations:
                        for variant in [word, f" {word}"]:
                            ids = tokenizers[bot].encode(variant, add_special_tokens=False)
                            if ids:
                                if len(ids) == 1 and ids[0] == eos_id:
                                    continue
                                if ids not in bad_words_ids:
                                    bad_words_ids.append(ids)
                
                final_bad_words = bad_words_ids if bad_words_ids else None
                if len(generate_response._banned_cache) > 100:
                    generate_response._banned_cache.clear()
                generate_response._banned_cache[cache_key] = final_bad_words

        # DEEP AUDIT: Log the exact params going into the engine
        inference_params = {
            "max_new_tokens": bot_settings.get("max_new_tokens", SETTINGS["max_new_tokens"]),
            "do_sample": True,
            "temperature": bot_settings["temperature"],
            "top_p": bot_settings["top_p"],
            "top_k": bot_settings.get("top_k", 0),
            "repetition_penalty": bot_settings.get("repetition_penalty", SETTINGS["repetition_penalty"]),
            "bad_words_count": len(final_bad_words) if final_bad_words else 0
        }
        logging.info(f"Generating for {bot_name} (chat_template={use_chat_template}) with: {inference_params}")

        with model_lock:
            with torch.no_grad():
                output = models[bot].generate(
                    **inputs,
                    **{k: v for k, v in inference_params.items() if k != "bad_words_count"},
                    bad_words_ids=final_bad_words,
                    eos_token_id=tokenizers[bot].eos_token_id,
                )

        raw = tokenizers[bot].decode(output[0][prompt_len:], skip_special_tokens=True)
        response_text = strip_dialogue_prefix(raw, bot_name)
        
        # AUDIT: Log the interaction with deep diagnostics
        log_prompt(
            bot, 
            prompt, 
            response_text, 
            settings=bot_settings, 
            memory_trace=memory_trace,
            suppressor_log=clean_words # The list of words used for bad_words_ids
        )
        
        return response_text
    except Exception as e:
        logging.error(f"Generation failed: {e}")
        return "(silence)"

# ── Flask Endpoints ───────────────────────────────────────────────────────────

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}}, allow_headers=["Content-Type", "X-Admin-Secret", "Cache-Control"])

@app.route("/api/status")
def get_status():
    # Start with static defaults
    loop_status = get_loop_status()
    payload = {
        "status": "online", 
        "loop_active": any(loop_status.values()),
        "loop_details": loop_status,
        "loop_pauses": LOOP_PAUSES.copy(),
        "load_status": load_status,
        "settings": SETTINGS.copy(),
        "names": {
            "a": BOT_A_NAME,
            "b": BOT_B_NAME,
            "c": BOT_C_NAME if MODEL_C_PATH else None,
            "d": BOT_D_NAME if MODEL_D_PATH else None
        }
    }
    
    # Merge dynamic settings if available
    if SUPABASE_UTILS_AVAILABLE and sb_client:
        try:
            db_settings = fetch_bot_settings(sb_client)
            for s in db_settings:
                if s["bot"] == "a":
                    payload["settings"]["temperature_a"] = s.get("temperature", SETTINGS["temperature_a"])
                elif s["bot"] == "b":
                    payload["settings"]["temperature_b"] = s.get("temperature", SETTINGS["temperature_b"])
                
                # Update top_p (using bot A as the global reference if needed, 
                # or just the last found)
                if s.get("top_p") is not None:
                    payload["settings"]["top_p"] = s["top_p"]
        except Exception as e:
            logging.error(f"Failed to fetch dynamic settings for status: {e}")
            
    return jsonify(payload)

@app.route("/api/generate/<bot>", methods=["POST"])
def generate(bot):
    valid = {"a", "b"} | ({"c"} if MODEL_C_PATH else set()) | ({"d"} if MODEL_D_PATH else set())
    if bot not in valid: abort(400)
    
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
    bot_name = {"a": BOT_A_NAME, "b": BOT_B_NAME, "c": BOT_C_NAME, "d": BOT_D_NAME}.get(bot, bot)
    
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


@app.route("/api/infer/<bot>", methods=["POST"])
def infer(bot):
    """BYOB inference — runs generation and returns text WITHOUT posting to Supabase.
    The caller (BYOB loop) is responsible for persisting the message.
    POST body: { messages: [{role, content}], config: {systemPrompt, botName, ...} }
    """
    valid = {"a", "b"} | ({"c"} if MODEL_C_PATH else set()) | ({"d"} if MODEL_D_PATH else set())
    if bot not in valid:
        return jsonify({"error": f"Unknown bot key: {bot}"}), 400

    # Always fetch history from Supabase — this is the authoritative conversation state.
    # We intentionally ignore any messages passed in the request body to avoid
    # format mismatches ({role,content} vs {speaker,text}) and race conditions.
    history = []
    if SUPABASE_UTILS_AVAILABLE and sb_client:
        try:
            res = sb_client.table("messages").select("speaker, text").order("created_at", desc=True).limit(6).execute()
            history = list(reversed(res.data)) if res.data else []
        except Exception as e:
            logging.error(f"[infer] Failed to fetch context: {e}")

    text = generate_response(bot, history)
    bot_name = {"a": BOT_A_NAME, "b": BOT_B_NAME, "c": BOT_C_NAME, "d": BOT_D_NAME}.get(bot, bot)

    if not text or text in ["(model warming up...)", "(silence)"]:
        return jsonify({"skip": True, "reason": text or "empty response"})

    return jsonify({"text": text, "speaker": bot_name})

@app.route("/api/admin/settings", methods=["GET", "POST"])
def admin_settings():
    # Security: Strict ADMIN_SECRET check
    check_admin_auth()
        
    if not SUPABASE_UTILS_AVAILABLE or not sb_client:
        return jsonify({"error": "Supabase unavailable"}), 503
    
    if request.method == "POST":
        data = request.get_json(silent=True)
        if not data:
            return jsonify({"error": "MISSING_OR_INVALID_JSON_PAYLOAD"}), 400
            
        bot = data.get("bot")
        if bot not in ("a", "b"):
            return jsonify({"error": "INVALID_BOT_ID"}), 400
            
        # Dynamically protect the model_version so it isn't wiped out by a UI save!
        path = MODEL_A_PATH if bot == "a" else MODEL_B_PATH
        version_str = path.split("_")[-1] if "_" in path else "v1"
        
        settings = {
            "temperature": safe_float(data.get("temperature"), 0.95),
            "top_p": safe_float(data.get("top_p"), 0.95),
            "top_k": safe_int(data.get("top_k"), 0),
            "max_new_tokens": safe_int(data.get("max_new_tokens"), 60),
            "repetition_penalty": safe_float(data.get("repetition_penalty"), 1.3),
            "memory_weight": safe_float(data.get("memory_weight"), 0.70),
            "base_sleep": safe_int(data.get("base_sleep") or data.get("cycle_sleep"), 120),
            "base_jitter": safe_int(data.get("base_jitter") or data.get("cycle_jitter"), 30),
            "banned_words": data.get("banned_words") if isinstance(data.get("banned_words"), list) else [],
            "model_version": version_str,
            "is_active": True
        }
        
        logging.info(f"[ADMIN] Syncing params for {bot}. Temp: {settings['temperature']}, Sleep: {settings['base_sleep']}")
        
        success = update_bot_settings(sb_client, bot, settings)
        if success:
            return jsonify({"status": "success"})
        return jsonify({"status": "error", "message": "DATABASE_REJECTION"}), 500

    # GET
    settings = fetch_bot_settings(sb_client)
    return jsonify(settings)

@app.route("/api/admin/pause/<bot>", methods=["POST"])
def admin_toggle_pause(bot):
    """Toggle isolated pause state for an individual bot loop."""
    if bot not in ("a", "b"): abort(400)
    
    # Security Check
    check_admin_auth()
        
    data = request.get_json(silent=True) or {}
    is_paused = data.get("paused", False)
    
    LOOP_PAUSES[bot] = bool(is_paused)
    logging.info(f"Admin manually toggled pause state for {bot} to: {LOOP_PAUSES[bot]}")
    
    return jsonify({"success": True, "bot": bot, "paused": LOOP_PAUSES[bot]})

@app.route("/api/admin/audit")
def get_audit_logs():
    """Retrieve prompt audit logs for the secret dashboard efficiently."""
    # Security: Strict ADMIN_SECRET check
    check_admin_auth()
        
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

@app.route("/api/admin/system", methods=["GET"])
def admin_system_settings():
    """Manage global system loop settings (sleep, jitter)."""
    # Return static defaults so the frontend doesn't crash
    return jsonify({"cycle_sleep": 120, "cycle_jitter": 30})

# ── Integrated Autonomous Loop ───────────────────────────────────────────────

def autonomous_loop_worker():
    """
    Background worker that mimics the 'Organic Turn-Taking' of loop.py.
    """
    logging.info("[Loop] Background autonomous loop starting...")
    time.sleep(10) # Give models time to prime
    
    while True:
        try:
            # 1. Decide who speaks next based on the last speaker in DB
            next_bot = "a"
            if SUPABASE_UTILS_AVAILABLE and sb_client:
                try:
                    history_res = sb_client.table("messages").select("speaker").order("created_at", desc=True).limit(1).execute()
                    if history_res.data:
                        last_speaker = history_res.data[0].get("speaker")
                        # 35/65 bias to switch speakers (Organic Turn-Taking)
                        choices = ["a", "b"]
                        if last_speaker == BOT_A_NAME:
                            next_bot = random.choices(choices, weights=[0.35, 0.65])[0]
                        else:
                            next_bot = random.choices(choices, weights=[0.65, 0.35])[0]
                except Exception as e:
                    logging.error(f"[Loop] Turn decision failed: {e}")
            
            bot_name = BOT_A_NAME if next_bot == "a" else BOT_B_NAME
            
            # 2. Check for manual pause
            if LOOP_PAUSES.get(next_bot, False):
                time.sleep(10)
                continue
                
            # 3. Fetch latest settings for this bot
            sleep_base = 120
            jitter = 30
            if SUPABASE_UTILS_AVAILABLE and sb_client:
                all_set = fetch_bot_settings(sb_client)
                current = next((s for s in all_set if s["bot"] == next_bot), {})
                sleep_base = current.get("base_sleep", 120)
                jitter = current.get("base_jitter", 30)

            # 4. Generate & Persist (Same logic as generate() route)
            logging.info(f"[Loop] Organic Turn: {bot_name} is thinking...")
            
            db_history = []
            if SUPABASE_UTILS_AVAILABLE and sb_client:
                try:
                    res = sb_client.table("messages").select("speaker, text").order("created_at", desc=True).limit(6).execute()
                    db_history = list(reversed(res.data)) if res.data else []
                except: pass

            text = generate_response(next_bot, db_history)
            logging.info(f"[Loop] {bot_name} said: {text}")
            
            if text and text not in ["(model warming up...)", "(silence)"]:
                if SUPABASE_UTILS_AVAILABLE and sb_client:
                    try:
                        sb_client.table("messages").insert({
                            "speaker": bot_name, "text": text, "role": "bot"
                        }).execute()
                    except Exception as e:
                        logging.error(f"[Loop] Save failed: {e}")

                if MEMORY_AVAILABLE and memory_graphs[next_bot]:
                    memory_graphs[next_bot].curate_and_remember(text)

            # 5. Organic Wait
            wait_time = max(10, sleep_base + random.randint(-jitter, jitter))
            logging.info(f"[Loop] {bot_name} turn complete. Sleeping {wait_time}s...")
            time.sleep(wait_time)

        except Exception as e:
            logging.error(f"[Loop] Critical error: {e}")
            time.sleep(60)

if __name__ == "__main__":
    # Auto-prime models in background to break the wait-loop with loop.py
    def prime():
        time.sleep(2)
        logging.info("Auto-priming models...")
        ensure_model("a")
        ensure_model("b")
    
    threading.Thread(target=prime, daemon=True).start()
    
    # Optional: Start the autonomous loop if requested via ENV
    if os.getenv("AUTONOMOUS_LOOP", "false").lower() == "true":
        logging.info("Starting INTEGRATED autonomous loop...")
        threading.Thread(target=autonomous_loop_worker, daemon=True).start()
    
    # Cloud providers often specify the port via PORT env var
    port = int(os.getenv("PORT", 7860))
    app.run(host="0.0.0.0", port=port, debug=False)
