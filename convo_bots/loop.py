from __future__ import annotations
"""
loop.py
-------
Autonomous conversation driver for brain.vat.

Calls the Flask server's /api/generate endpoints on a timer so Mauk and
Abaci converse continuously and write their messages to Supabase — which
the Next.js frontend picks up in real time.

No Twitter credentials required. Run alongside server.py.

Usage:
    # Terminal 1 — start the Flask server
    python server.py

    # Terminal 2 — start the conversation loop
    python loop.py

    # Optional flags
    python loop.py --sleep 60 --jitter 15 --only-a   # run just Mauk (until Abaci is ready)
    python loop.py --dry-run                          # print what would happen, no HTTP calls

Env vars (loaded from .env):
    CYCLE_SLEEP   — seconds between full exchanges (default: 120)
    CYCLE_JITTER  — ± random variance in seconds    (default: 30)
    SERVER_URL    — Flask base URL                  (default: http://localhost:5000)
    BOT_A_NAME    — used only for log labels        (default: MAUK)
    BOT_B_NAME    — used only for log labels        (default: ABACI)
"""

import os
import sys
import time
import random
import logging
import argparse
from datetime import datetime

import requests
from dotenv import load_dotenv

# Import supabase utils
from supabase_utils import get_supabase_client, get_last_speaker

load_dotenv()

# Initialize Supabase client
sb_client = get_supabase_client()

# PID file management
PID_FILE = None

def cleanup_pid():
    if PID_FILE and os.path.exists(PID_FILE):
        os.remove(PID_FILE)

import atexit
atexit.register(cleanup_pid)

# ── Config ────────────────────────────────────────────────────────────────────

SERVER_URL   = os.getenv("SERVER_URL",   "http://127.0.0.1:5001")
CYCLE_SLEEP  = int(os.getenv("CYCLE_SLEEP",  120))   # 2 minutes default
CYCLE_JITTER = int(os.getenv("CYCLE_JITTER",  30))

BOT_A_NAME   = os.getenv("BOT_A_NAME", "MAUK")
BOT_B_NAME   = os.getenv("BOT_B_NAME", "ABACI")

# ── Logging ───────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [loop] %(message)s",
    datefmt="%H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("loop.log"),
    ],
)
log = logging.getLogger("loop")

# ── Helpers ───────────────────────────────────────────────────────────────────

def wait_for_server(timeout: int = 60) -> bool:
    """Block until the Flask server is reachable, or timeout."""
    log.info(f"Waiting for server at {SERVER_URL} ...")
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            r = requests.get(f"{SERVER_URL}/api/status", timeout=3)
            if r.ok:
                data = r.json()
                log.info(f"Server ready. Bots: {data.get('bots')}")
                return True
        except requests.exceptions.ConnectionError:
            pass
        time.sleep(2)
    log.error(f"Server not reachable after {timeout}s. Is server.py running?")
    return False


def bot_status(bot: str) -> str:
    """Return the model load status for bot 'a' or 'b'."""
    try:
        r = requests.get(f"{SERVER_URL}/api/status", timeout=5)
        if r.ok:
            # Match the new server response format: {"load_status": {"a": "ready", ...}}
            data = r.json()
            return data.get("load_status", {}).get(bot, "unknown")
    except Exception:
        pass
    return "unknown"


def trigger_generate(bot: str, dry_run: bool = False) -> dict | None:
    """
    POST /api/generate/<bot> to make a bot produce its next turn.
    Returns the message dict on success, None on failure.
    """
    bot_name = BOT_A_NAME if bot == "a" else BOT_B_NAME
    url = f"{SERVER_URL}/api/generate/{bot}"

    if dry_run:
        log.info(f"[DRY RUN] Would POST {url}")
        return {"speaker": bot_name, "text": "(dry run)", "id": "0"}

    try:
        log.info(f"Triggering {bot_name} ...")
        # Explicitly send JSON to avoid 415 Unsupported Media Type error
        r = requests.post(url, json={"history": []}, timeout=120)
        if r.ok:
            msg = r.json()
            log.info(f"[{bot_name}] → \"{msg.get('text', '')}\"")
            return msg
        else:
            log.warning(f"[{bot_name}] generate returned {r.status_code}: {r.text[:120]}")
            return None
    except requests.exceptions.Timeout:
        log.warning(f"[{bot_name}] Request timed out (model still loading?)")
        return None
    except Exception as e:
        log.error(f"[{bot_name}] Unexpected error: {e}")
        return None


def wait_for_model(bot: str, timeout: int = 300) -> bool:
    """
    Block until the model is loaded (status == 'ready') or in demo mode.
    Returns True if usable, False if error or timeout.
    """
    bot_name = BOT_A_NAME if bot == "a" else BOT_B_NAME
    deadline = time.time() + timeout
    logged_loading = False

    while time.time() < deadline:
        status = bot_status(bot)
        if status in ("ready", "demo"):
            log.info(f"[{bot_name}] Model status: {status}")
            return True
        if status == "error":
            log.error(f"[{bot_name}] Model failed to load. Check server logs.")
            return False
        if not logged_loading:
            log.info(f"[{bot_name}] Model loading ... (will wait up to {timeout}s)")
            logged_loading = True
        time.sleep(5)

    log.error(f"[{bot_name}] Model did not become ready within {timeout}s.")
    return False


# ── Main loop ─────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="brain.vat autonomous conversation loop")
    parser.add_argument("--sleep",    type=int, default=CYCLE_SLEEP,
                        help=f"Seconds between exchanges (default {CYCLE_SLEEP})")
    parser.add_argument("--jitter",   type=int, default=CYCLE_JITTER,
                        help=f"±Jitter in seconds (default {CYCLE_JITTER})")
    parser.add_argument("--only-a",   action="store_true",
                        help="Only trigger Mauk (use while Abaci isn't trained yet)")
    parser.add_argument("--only-b",   action="store_true",
                        help="Only trigger Abaci")
    parser.add_argument("--pause",    type=int, default=45,
                        help="Seconds to pause between the two bot turns (default 45)")
    parser.add_argument("--dry-run",  action="store_true",
                        help="Print what would happen without making HTTP calls")
    parser.add_argument("--cycles",   type=int, default=0,
                        help="Run this many cycles then stop (0 = run forever)")
    args = parser.parse_args()

    # Dynamic PID naming for independent processes
    global PID_FILE
    if args.only_a: PID_FILE = "loop_a.pid"
    elif args.only_b: PID_FILE = "loop_b.pid"
    else: PID_FILE = "loop_unified.pid"
    
    with open(PID_FILE, "w") as f:
        f.write(str(os.getpid()))

    log.info("=" * 60)
    log.info("brain.vat conversation loop starting")
    log.info(f"  Server:  {SERVER_URL}")
    log.info(f"  Bots:    {BOT_A_NAME} ({'on' if not args.only_b else 'off'}) / "
             f"{BOT_B_NAME} ({'on' if not args.only_a else 'off'})")
    log.info(f"  Sleep:   {args.sleep}s ±{args.jitter}s between exchanges")
    log.info(f"  Pause:   {args.pause}s between bot turns")
    if args.dry_run:
        log.info("  Mode:    DRY RUN")
    if args.cycles:
        log.info(f"  Cycles:  {args.cycles} (then stop)")
    log.info("=" * 60)

    # Wait for Flask to come up
    if not args.dry_run:
        if not wait_for_server():
            sys.exit(1)

        # Wait for Mauk to load (she's first and always runs)
        if not args.only_b:
            if not wait_for_model("a"):
                log.warning(f"{BOT_A_NAME} model not ready — will run in demo mode")

        # Only wait for Abaci if we're running her
        if not args.only_a:
            abaci_status = bot_status("b")
            if abaci_status == "demo":
                log.info(f"{BOT_B_NAME} checkpoint not found — running in demo mode")
            elif abaci_status != "ready":
                if not wait_for_model("b", timeout=120):
                    log.warning(f"{BOT_B_NAME} not ready — will run in demo mode")

    cycle = 0

    log.info("Organic turn-taking mode active.")
    
    while True:
        cycle += 1
        
        # ── DYNAMIC SETTINGS POLLING ──────────────────────────────
        # Determine which bot(s) we are managing in this process
        active_bots = []
        if args.only_a: active_bots = ["a"]
        elif args.only_b: active_bots = ["b"]
        else: active_bots = ["a", "b"]

        current_bot = active_bots[0] # For single-bot speed polling
        
        try:
            # Fetch latest settings for the specific bot(s) from the server
            r = requests.get(f"{SERVER_URL}/api/admin/settings", headers={"X-Admin-Secret": os.getenv("ADMIN_SECRET", "31415926535")}, timeout=10)
            if r.ok:
                db_settings = r.json()
                # Find settings for our active bot
                relevant = [s for s in db_settings if s["bot"] in active_bots]
                if relevant:
                    # If we manage one bot, use its specific timing
                    target = relevant[0]
                    args.sleep = target.get("base_sleep", args.sleep)
                    args.jitter = target.get("base_jitter", args.jitter)
                    log.info(f"Dynamic timing synced for {target['bot']}: Sleep {args.sleep}s, Jitter {args.jitter}s")
        except Exception as e:
            log.warning(f"Failed to poll bot settings: {e}")

        # ── DECIDE WHO SPEAKS NEXT ────────────────────────────────
        # If we are managing only ONE bot, we always speak (after waiting)
        # unless it's a dry run or model isn't ready.
        if len(active_bots) == 1:
            next_bot = active_bots[0]
        else:
            # LEGACY / UNIFIED MODE: Decide who speaks next sequentially
            last_speaker = "UNKNOWN"
            if sb_client:
                try:
                    history_res = sb_client.table("messages").select("speaker").order("created_at", desc=True).limit(2).execute()
                    if history_res.data:
                        last_speaker = history_res.data[0].get("speaker")
                except: pass

            choices = ["a", "b"]
            if last_speaker == BOT_A_NAME:
                next_bot = random.choices(choices, weights=[0.35, 0.65])[0]
            else:
                next_bot = random.choices(choices, weights=[0.65, 0.35])[0]
        
        next_bot_name = BOT_A_NAME if next_bot == "a" else BOT_B_NAME

        log.info(f"\n{'─' * 50}")
        log.info(f"Organic Turn {cycle} — {next_bot_name} is thinking...")
        log.info(f"{'─' * 50}")

        # ── ACTIVE PAUSE CHECK ────────────────────────────────────
        is_paused = False
        try:
            status_req = requests.get(f"{SERVER_URL}/api/status", timeout=5)
            if status_req.ok:
                pauses = status_req.json().get("loop_pauses", {})
                if pauses.get(next_bot, False):
                    is_paused = True
                    log.info(f"[{next_bot_name}] Suspended by Admin Control Panel. Sleeping for 5s...")
        except Exception as e:
            log.warning(f"Failed to check pause status: {e}")

        if is_paused:
            time.sleep(5)
            continue

        if not args.dry_run:
            trigger_generate(next_bot, dry_run=args.dry_run)
            
        # ── ORGANIC THINKING DELAY ─────────────────────────────
        # Use the bot-specific sleep and jitter to determine wait time
        wait_time = max(10, args.sleep + random.randint(-args.jitter, args.jitter))
        wake_at = datetime.fromtimestamp(time.time() + wait_time).strftime("%H:%M:%S")
        log.info(f"Next {next_bot} turn in {wait_time}s (at {wake_at})...")

        if not args.dry_run:
            time.sleep(wait_time)

        if args.cycles and cycle >= args.cycles:
            log.info(f"Reached {args.cycles} cycle(s). Stopping.")
            break


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log.info("\nLoop stopped by user. Goodbye.")
