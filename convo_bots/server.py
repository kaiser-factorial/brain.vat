"""
server.py
---------
Flask backend for the two-bot desktop conversation app.

Endpoints:
  GET  /api/status                      - health check + model load state
  POST /api/generate/<bot>              - generate one turn for a bot
  GET  /api/conversation                - full conversation history
  POST /api/conversation                - add a message (user or bot)
  DEL  /api/conversation                - clear history
  GET  /api/files/<space>               - list files in a workspace
  POST /api/files/<space>               - upload / create a text file
  GET  /api/files/<space>/<name>        - read a file
  DEL  /api/files/<space>/<name>        - delete a file
  GET  /api/memory/<bot>                - get memory graph stats + obsessions
  POST /api/settings                    - update generation settings at runtime

Workspaces:  bot_a | bot_b | shared
Bots:        a | b

Run:
    pip install flask flask-cors
    python server.py

Then open app.html in your browser.
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

load_dotenv()

# ── Optional: load models if checkpoints exist ─────────────────────────────────
# Models are loaded lazily on first /api/generate call so the server
# starts instantly even if checkpoints aren't ready yet.
try:
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    print("[server] torch/transformers not installed — running in DEMO mode (no generation)")

try:
    from memory_graph import MemoryGraph
    MEMORY_AVAILABLE = True
except ImportError:
    MEMORY_AVAILABLE = False
    print("[server] memory_graph.py not found — memory disabled")

# ── Supabase (optional) ───────────────────────────────────────────────────────

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")   # service role key bypasses RLS

_supabase_client = None

def get_supabase():
    global _supabase_client
    if _supabase_client is None and SUPABASE_URL and SUPABASE_KEY:
        try:
            from supabase import create_client
            _supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
            print("[server] Supabase connected.")
        except Exception as e:
            print(f"[server] Supabase init failed: {e}")
    return _supabase_client

# ── Config ────────────────────────────────────────────────────────────────────

BASE_DIR      = Path(__file__).parent
WORKSPACE_DIR = BASE_DIR / "workspace"
MEMORY_DIR    = BASE_DIR / "memory"

MODEL_A_PATH  = os.getenv("MODEL_A_PATH", str(BASE_DIR.parent / "model_checkpoint_a"))
MODEL_B_PATH  = os.getenv("MODEL_B_PATH", str(BASE_DIR.parent / "model_checkpoint_b"))

# Bot identities — change these to match your aesthetic
BOT_A_NAME = os.getenv("BOT_A_NAME", "MAUK")   # surrealist-poetry-injected-with-math
BOT_B_NAME = os.getenv("BOT_B_NAME", "ABACI")      # math-injected-with-poetry
USER_NAME  = os.getenv("USER_NAME",  "CORINA")

# Generation defaults (overridable via POST /api/settings)
SETTINGS = {
    "temperature":        float(os.getenv("TEMPERATURE",        0.90)),
    "top_p":              float(os.getenv("TOP_P",              0.95)),
    "repetition_penalty": float(os.getenv("REPETITION_PENALTY", 1.30)),
    "max_new_tokens":     int(os.getenv("MAX_NEW_TOKENS",       55)),
    "context_turns":      int(os.getenv("CONTEXT_TURNS",        6)),    # how many past messages to include
    "memory_blend":       float(os.getenv("MEMORY_BLEND",       0.45)), # prob of injecting a memory obsession
}

BANNED_WORDS = ["iced", " iced", "Iced", " Iced"]

# ── Workspace dirs ────────────────────────────────────────────────────────────

for space in ("bot_a", "bot_b", "shared"):
    (WORKSPACE_DIR / space).mkdir(parents=True, exist_ok=True)
MEMORY_DIR.mkdir(parents=True, exist_ok=True)

# ── Conversation store (in-memory + persisted to JSON) ───────────────────────

CONVERSATION_FILE = BASE_DIR / "conversation.json"

def _load_conversation():
    if CONVERSATION_FILE.exists():
        return json.loads(CONVERSATION_FILE.read_text())
    return []

def _save_conversation(history):
    CONVERSATION_FILE.write_text(json.dumps(history, indent=2))

conversation_lock = threading.Lock()
conversation: list[dict] = _load_conversation()

def add_message(speaker: str, text: str, role: str = "bot", user_id: str = None) -> dict:
    msg = {
        "id":        f"{time.time():.3f}",
        "speaker":   speaker,
        "text":      text,
        "role":      role,   # "bot" | "user"
        "timestamp": datetime.utcnow().isoformat(),
    }
    with conversation_lock:
        conversation.append(msg)
        _save_conversation(conversation)

    # Mirror to Supabase if connected
    sb = get_supabase()
    if sb:
        try:
            sb.table("messages").insert({
                "speaker":  speaker,
                "text":     text,
                "role":     role,
                "user_id":  user_id,
            }).execute()
        except Exception as e:
            logging.warning(f"Supabase message insert failed: {e}")

    return msg

# ── Model loading (lazy, thread-safe) ────────────────────────────────────────

models  = {"a": None, "b": None}
tokenizers = {"a": None, "b": None}
model_lock = threading.Lock()
load_status = {"a": "unloaded", "b": "unloaded"}   # unloaded | loading | ready | error | demo

def get_device():
    if not TORCH_AVAILABLE:
        return None
    if torch.backends.mps.is_available():
        return torch.device("mps")
    if torch.cuda.is_available():
        return torch.device("cuda")
    return torch.device("cpu")

DEVICE = get_device()

def ensure_model(bot: str):
    """Load a model if not already loaded. Thread-safe."""
    if not TORCH_AVAILABLE:
        load_status[bot] = "demo"
        return False

    with model_lock:
        if models[bot] is not None:
            return True
        if load_status[bot] == "loading":
            return False

        path = MODEL_A_PATH if bot == "a" else MODEL_B_PATH
        if not Path(path).exists():
            print(f"[server] Checkpoint not found at {path} — bot {bot} in demo mode")
            load_status[bot] = "demo"
            return False

        load_status[bot] = "loading"

    # Load outside lock so other threads aren't blocked
    try:
        print(f"[server] Loading bot {bot} from {path} on {DEVICE}...")
        tok = AutoTokenizer.from_pretrained(path)
        tok.pad_token = tok.eos_token
        mdl = AutoModelForCausalLM.from_pretrained(path)
        # Resolve tied/meta weights before moving to device
        mdl.tie_weights()
        try:
            mdl = mdl.to(DEVICE)
        except NotImplementedError:
            # Meta tensors can't be copied directly — use to_empty + reload
            mdl = mdl.to_empty(device=DEVICE)
            state = AutoModelForCausalLM.from_pretrained(path).state_dict()
            mdl.load_state_dict(state, strict=False)
        mdl.eval()
        with model_lock:
            models[bot] = mdl
            tokenizers[bot] = tok
            load_status[bot] = "ready"
        print(f"[server] Bot {bot} ready.")
        return True
    except Exception as e:
        print(f"[server] Error loading bot {bot}: {e}")
        with model_lock:
            load_status[bot] = "error"
        return False

# ── Memory graphs ─────────────────────────────────────────────────────────────

memory = {"a": None, "b": None}

def get_memory(bot: str) -> "MemoryGraph | None":
    if not MEMORY_AVAILABLE:
        return None
    
    mdl = models.get(bot)
    tok = tokenizers.get(bot)

    if memory[bot] is None:
        name  = BOT_A_NAME if bot == "a" else BOT_B_NAME
        path  = str(MEMORY_DIR / f"memory_{bot}.json")
        memory[bot] = MemoryGraph(
            path, bot_name=name, bot_key=bot,
            model=mdl, tokenizer=tok, device=DEVICE,
        )
    else:
        # Hot-reload models into memory graph if they finished loading
        if memory[bot].model is None and mdl is not None:
            memory[bot].model = mdl
            memory[bot].tokenizer = tok
            
    return memory[bot]

# ── Dialogue prompt builder ───────────────────────────────────────────────────

def build_dialogue_prompt(history: list[dict], generating_bot: str) -> str:
    """
    Format conversation history as a structured completion document.

    GPT2 isn't instruction-tuned, so we can't ask it to "respond as X".
    Instead we build a document it has to *complete*:

        [MAUK]: the moon is an open set
        [ABACI]: but which topology defines your grief
        [MAUK]:

    The model fills in after the final `[NAME]:` marker.
    Key: after generation, strip the prefix and truncate at the next `[`
    so the model doesn't keep writing the next speaker's turn too.
    """
    bot_name = BOT_A_NAME if generating_bot == "a" else BOT_B_NAME
    n        = SETTINGS["context_turns"]

    lines = []
    for msg in history[-n:]:
        speaker = msg["speaker"]
        text    = msg["text"].strip().replace("\n", " ")
        lines.append(f"[{speaker}]: {text}")

    lines.append(f"[{bot_name}]:")
    return "\n".join(lines)


def strip_dialogue_prefix(text: str, bot_name: str) -> str:
    """Remove the leading `[NAME]: ` prefix and cut at the next speaker marker."""
    prefix = f"[{bot_name}]:"
    if text.startswith(prefix):
        text = text[len(prefix):].strip()

    # Cut at the next speaker turn so the model doesn't write both sides
    next_turn = re.search(r"\[([A-Z]+)\]:", text)
    if next_turn:
        text = text[:next_turn.start()].strip()

    # Trim to clean sentence boundary
    for punct in (".", "!", "?", "…"):
        last = text.rfind(punct)
        if last != -1 and last > len(text) // 3:
            return text[:last + 1].strip()

    return text.strip()


def generate_response(bot: str, history: list[dict]) -> str:
    """Generate a bot's next turn. Falls back to demo text if model not loaded."""
    bot_name = BOT_A_NAME if bot == "a" else BOT_B_NAME

    # Demo mode fallbacks
    demo_lines = {
        "a": [
            "the moon is an open set and I cannot find its boundary.",
            "proof by contradiction: you exist, therefore I am undefined.",
            "topology of grief — no boundary, only accumulation points.",
            "god is a degenerate function defined nowhere and everywhere.",
            "every limit point of sorrow belongs to the closure of my chest.",
        ],
        "b": [
            "let x be the colour of your silence. it converges.",
            "assume continuity. the proof breaks at the point of contact.",
            "by the axiom of choice, I selected this particular longing.",
            "the sequence of your words has no Cauchy subsequence.",
            "for all ε > 0, there exists a δ of moonlight.",
        ],
    }

    status = load_status[bot]

    if status in ("demo", "error", "unloaded") or not ensure_model(bot):
        import random
        return random.choice(demo_lines[bot])

    if load_status[bot] != "ready":
        return "(model loading...)"

    # Inject memory obsession into prompt
    mem  = get_memory(bot)
    prompt = build_dialogue_prompt(history, bot)
    if mem:
        import random
        obsessions = mem.obsessions(5)
        if obsessions and random.random() < SETTINGS["memory_blend"]:
            concept = random.choice(obsessions)
            prompt  = f"({concept}) {prompt}"

    bad_words_ids = [
        tokenizers[bot].encode(w)
        for w in BANNED_WORDS
        if tokenizers[bot].encode(w)
    ]

    try:
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
                pad_token_id=tokenizers[bot].eos_token_id,
                bad_words_ids=bad_words_ids or None,
            )

        new_tokens = output[0][prompt_len:]
        raw = tokenizers[bot].decode(new_tokens, skip_special_tokens=True).strip()
        result = strip_dialogue_prefix(raw, bot_name)

        # Update memory — let the bot curate what it keeps
        if mem and result:
            mem.curate_and_remember(result)

        return result or "(silence)"

    except Exception as e:
        logging.error(f"Generation error for bot {bot}: {e}")
        return f"(generation error: {e})"


# ── Flask app ─────────────────────────────────────────────────────────────────

app = Flask(__name__)
CORS(app)

@app.route("/api/status")
def status():
    return jsonify({
        "bots": {
            "a": {"name": BOT_A_NAME, "status": load_status["a"]},
            "b": {"name": BOT_B_NAME, "status": load_status["b"]},
        },
        "user":    USER_NAME,
        "device":  str(DEVICE),
        "torch":   TORCH_AVAILABLE,
        "memory":  MEMORY_AVAILABLE,
        "settings": SETTINGS,
    })


@app.route("/api/generate/<bot>", methods=["POST"])
def generate(bot):
    if bot not in ("a", "b"):
        abort(400, "bot must be 'a' or 'b'")

    with conversation_lock:
        history = list(conversation)

    text = generate_response(bot, history)
    if not text:
        abort(500, "generation returned empty string")

    speaker = BOT_A_NAME if bot == "a" else BOT_B_NAME
    msg = add_message(speaker, text, role="bot")
    return jsonify(msg)


@app.route("/api/conversation", methods=["GET"])
def get_conversation():
    with conversation_lock:
        return jsonify(list(conversation))


@app.route("/api/conversation", methods=["POST"])
def post_message():
    """Add a user message to the conversation."""
    data = request.get_json(force=True)
    text = (data.get("text") or "").strip()
    if not text:
        abort(400, "text required")
    speaker = data.get("speaker", USER_NAME)
    msg = add_message(speaker, text, role="user")
    return jsonify(msg)


@app.route("/api/conversation", methods=["DELETE"])
def clear_conversation():
    global conversation
    with conversation_lock:
        conversation = []
        _save_conversation(conversation)
    return jsonify({"ok": True})


# ── File workspace ────────────────────────────────────────────────────────────

ALLOWED_SPACES = {"bot_a", "bot_b", "shared"}

def _space_dir(space: str) -> Path:
    if space not in ALLOWED_SPACES:
        abort(400, f"space must be one of {ALLOWED_SPACES}")
    return WORKSPACE_DIR / space


@app.route("/api/files/<space>", methods=["GET"])
def list_files(space):
    d = _space_dir(space)
    files = []
    for f in sorted(d.iterdir()):
        if f.is_file():
            files.append({
                "name":     f.name,
                "size":     f.stat().st_size,
                "modified": datetime.fromtimestamp(f.stat().st_mtime).isoformat(),
            })
    return jsonify(files)


@app.route("/api/files/<space>", methods=["POST"])
def create_file(space):
    d = _space_dir(space)
    data = request.get_json(force=True)
    name    = data.get("name", "").strip()
    content = data.get("content", "")
    if not name:
        abort(400, "name required")
    # Basic path-traversal guard
    target = (d / name).resolve()
    if not str(target).startswith(str(d.resolve())):
        abort(400, "invalid filename")
    target.write_text(content, encoding="utf-8")
    return jsonify({"ok": True, "name": name})


@app.route("/api/files/<space>/<name>", methods=["GET"])
def read_file(space, name):
    d      = _space_dir(space)
    target = (d / name).resolve()
    if not str(target).startswith(str(d.resolve())) or not target.exists():
        abort(404)
    return jsonify({"name": name, "content": target.read_text(encoding="utf-8")})


@app.route("/api/files/<space>/<name>", methods=["DELETE"])
def delete_file(space, name):
    d      = _space_dir(space)
    target = (d / name).resolve()
    if not str(target).startswith(str(d.resolve())) or not target.exists():
        abort(404)
    target.unlink()
    return jsonify({"ok": True})


# ── Memory ────────────────────────────────────────────────────────────────────

@app.route("/api/memory/<bot>")
def memory_stats(bot):
    if bot not in ("a", "b"):
        abort(400)
    mem = get_memory(bot)
    if mem is None:
        return jsonify({"available": False})
    return jsonify({"available": True, **mem.stats()})


# ── Settings ──────────────────────────────────────────────────────────────────

@app.route("/api/settings", methods=["POST"])
def update_settings():
    data = request.get_json(force=True)
    for key in SETTINGS:
        if key in data:
            SETTINGS[key] = type(SETTINGS[key])(data[key])
    return jsonify(SETTINGS)


# ── Start ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print(f"[server] Starting on http://localhost:5000")
    print(f"[server] Bot A ({BOT_A_NAME}): {MODEL_A_PATH}")
    print(f"[server] Bot B ({BOT_B_NAME}): {MODEL_B_PATH}")
    print(f"[server] Device: {DEVICE}")
    print(f"[server] Workspaces: {WORKSPACE_DIR}")
    print()

    # Kick off model loading in background threads so the server is
    # immediately responsive and models load while you open the UI
    threading.Thread(target=ensure_model, args=("a",), daemon=True).start()
    threading.Thread(target=ensure_model, args=("b",), daemon=True).start()

    app.run(host="127.0.0.1", port=5000, debug=False, threaded=True)
