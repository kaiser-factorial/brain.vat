"""
test_connection.py
------------------
Validates each layer of the brain.vat stack before running the full server.

Run from the twitter_bots/ directory:
    python test_connection.py

Checks:
  1. .env loads correctly
  2. Supabase connection + tables exist
  3. Supabase write + read (inserts a test message, then deletes it)
  4. Model checkpoint files are present
  5. Torch + MPS device available
  6. Flask server reachable (if already running)
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

PASS = "  ✓"
FAIL = "  ✗"
SKIP = "  –"

errors = []

def ok(msg):   print(f"{PASS}  {msg}")
def fail(msg): print(f"{FAIL}  {msg}"); errors.append(msg)
def skip(msg): print(f"{SKIP}  {msg}")
def header(msg): print(f"\n── {msg}")

# ── 1. Env vars ───────────────────────────────────────────────────────────────

header("Environment")

supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
model_a_path = os.getenv("MODEL_A_PATH", "../model_checkpoint_mauk_0")
model_b_path = os.getenv("MODEL_B_PATH", "../model_checkpoint_abaci_0")

if supabase_url:
    ok(f"SUPABASE_URL = {supabase_url}")
else:
    fail("SUPABASE_URL missing from .env")

if supabase_key and supabase_key != "your-service-role-key-here":
    ok("SUPABASE_SERVICE_KEY present")
else:
    fail("SUPABASE_SERVICE_KEY missing or still placeholder in .env")

ok(f"MODEL_A_PATH = {model_a_path}")
ok(f"MODEL_B_PATH = {model_b_path}")

# ── 2. Supabase connection ────────────────────────────────────────────────────

header("Supabase connection")

sb = None
try:
    from supabase import create_client
    sb = create_client(supabase_url, supabase_key)
    ok("Supabase client created")
except ImportError:
    fail("supabase package not installed — run: pip install supabase")
except Exception as e:
    fail(f"Supabase client error: {e}")

# ── 3. Supabase tables ────────────────────────────────────────────────────────

header("Supabase tables")

EXPECTED_TABLES = ["messages", "memory_concepts", "workspace_files", "profiles"]

if sb:
    for table in EXPECTED_TABLES:
        try:
            result = sb.table(table).select("*").limit(1).execute()
            ok(f"Table '{table}' exists and is readable")
        except Exception as e:
            fail(f"Table '{table}' error: {e}")
else:
    for table in EXPECTED_TABLES:
        skip(f"Table '{table}' (skipped — no Supabase connection)")

# ── 4. Supabase write + delete (round-trip test) ──────────────────────────────

header("Supabase write/read round-trip")

if sb:
    try:
        insert = sb.table("messages").insert({
            "speaker": "_TEST_",
            "text":    "connection test — safe to ignore",
            "role":    "bot",
        }).execute()

        inserted_id = insert.data[0]["id"]
        ok(f"Inserted test row (id: {inserted_id})")

        # Read it back
        read = sb.table("messages").select("*").eq("id", inserted_id).execute()
        assert read.data[0]["speaker"] == "_TEST_"
        ok("Read back test row successfully")

        # Clean up
        sb.table("messages").delete().eq("id", inserted_id).execute()
        ok("Deleted test row (table is clean)")

    except Exception as e:
        fail(f"Round-trip test failed: {e}")
else:
    skip("Round-trip test (skipped — no Supabase connection)")

# ── 5. Model checkpoint files ─────────────────────────────────────────────────

header("Model checkpoints")

base = Path(__file__).parent

for label, raw_path in [("Mauk (A)", model_a_path), ("Abaci (B)", model_b_path)]:
    path = (base / raw_path).resolve()
    required = ["config.json", "tokenizer.json", "tokenizer_config.json"]
    model_files = ["model.safetensors", "pytorch_model.bin"]

    if not path.exists():
        fail(f"{label}: checkpoint folder not found at {path}")
        continue

    ok(f"{label}: folder found at {path}")

    for f in required:
        if (path / f).exists():
            ok(f"{label}: {f} present")
        else:
            fail(f"{label}: {f} MISSING")

    if any((path / f).exists() for f in model_files):
        found = next(f for f in model_files if (path / f).exists())
        ok(f"{label}: model weights ({found}) present")
    else:
        fail(f"{label}: no model weights found (expected model.safetensors or pytorch_model.bin)")

# ── 6. Torch + device ─────────────────────────────────────────────────────────

header("Torch + inference device")

try:
    import torch
    ok(f"torch {torch.__version__} installed")

    if torch.backends.mps.is_available():
        ok("MPS (Apple Silicon) available — will use GPU acceleration")
    elif torch.cuda.is_available():
        ok(f"CUDA available — device: {torch.cuda.get_device_name(0)}")
    else:
        ok("CPU only — inference will be slower but works fine")

except ImportError:
    fail("torch not installed — run: pip install torch")

# ── 7. Flask server (if running) ──────────────────────────────────────────────

header("Flask server (optional — only if already running)")

try:
    import requests
    r = requests.get("http://localhost:5000/api/status", timeout=2)
    if r.ok:
        data = r.json()
        ok(f"Server reachable. Mauk: {data['bots']['a']['status']}, Abaci: {data['bots']['b']['status']}")
    else:
        skip(f"Server returned {r.status_code}")
except Exception:
    skip("Server not running (start with: python server.py)")

# ── Summary ───────────────────────────────────────────────────────────────────

print()
if not errors:
    print("━" * 50)
    print("  All checks passed. You're ready to run:")
    print("    python server.py")
    print("    python loop.py --only-a")
    print("━" * 50)
else:
    print("━" * 50)
    print(f"  {len(errors)} issue(s) to fix before running:")
    for e in errors:
        print(f"    • {e}")
    print("━" * 50)

sys.exit(len(errors))
