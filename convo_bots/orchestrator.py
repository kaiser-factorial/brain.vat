"""
orchestrator.py
---------------
Runs the autonomous conversation loop between Bot A and Bot B.

Architecture:
  - Bot A: GPT2 fine-tuned on surrealist poetry injected with math
  - Bot B: GPT2 fine-tuned on math injected with surrealist poetry (train separately)
  - Each bot reads the other's last tweet as a prompt seed, generates a reply,
    posts it, and updates its own memory graph.

Setup:
  1. Copy your .env file (see .env.example) with Twitter API credentials.
  2. Set MODEL_A and MODEL_B below (or via env vars) to your checkpoint paths.
  3. Run: python orchestrator.py

Twitter API note:
  Both bots need separate Twitter developer apps and credentials.
  Write access requires the Basic tier ($100/month) or higher.
  Apply at: https://developer.twitter.com/en/portal/dashboard
"""

import os
import sys
import time
import random
import logging
from datetime import datetime
from dotenv import load_dotenv
import tweepy

from generate import load_model, generate_tweet, seed_prompt_from_tweet, get_device
from memory_graph import MemoryGraph

load_dotenv()

# ── Logging ───────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(message)s",
    datefmt="%H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("orchestrator.log"),
    ],
)
log = logging.getLogger("orchestrator")


# ── Config ────────────────────────────────────────────────────────────────────

# Paths to your saved model checkpoints (from save_model.py)
# Override with env vars MODEL_A_PATH / MODEL_B_PATH if preferred
MODEL_A_PATH = os.getenv("MODEL_A_PATH", "../model_checkpoint_a")
MODEL_B_PATH = os.getenv("MODEL_B_PATH", "../model_checkpoint_b")

# Memory graph persistence files
MEMORY_A_PATH = os.getenv("MEMORY_A_PATH", "memory_bot_a.json")
MEMORY_B_PATH = os.getenv("MEMORY_B_PATH", "memory_bot_b.json")

# How long to sleep between each full exchange (seconds)
# Default: 20 minutes. Be generous — Twitter rate limits are unforgiving.
CYCLE_SLEEP = int(os.getenv("CYCLE_SLEEP", 1200))

# Jitter added to cycle sleep so posts don't feel mechanical (seconds)
CYCLE_JITTER = int(os.getenv("CYCLE_JITTER", 180))

# Generation settings
TEMPERATURE        = float(os.getenv("TEMPERATURE", .91))
TOP_P              = float(os.getenv("TOP_P", 0.95))
REPETITION_PENALTY = float(os.getenv("REPETITION_PENALTY", 1.2))
MAX_NEW_TOKENS     = int(os.getenv("MAX_NEW_TOKENS", 55))

# Fallback prompts used when the other bot has no tweets yet, or on error
BOT_A_FALLBACK_PROMPTS = [
    "I think",
    "I want",
    "Maybe",
    
]

BOT_B_FALLBACK_PROMPTS = [
    "I think",
    "I want",
    "Maybe",
]


# ── Twitter client factory ────────────────────────────────────────────────────

def make_twitter_client(prefix: str) -> tweepy.Client:
    """Build a Tweepy v2 client from env vars prefixed with BOT_A_ or BOT_B_."""
    return tweepy.Client(
        consumer_key        = os.environ[f"{prefix}_API_KEY"],
        consumer_secret     = os.environ[f"{prefix}_API_SECRET"],
        access_token        = os.environ[f"{prefix}_ACCESS_TOKEN"],
        access_token_secret = os.environ[f"{prefix}_ACCESS_TOKEN_SECRET"],
    )


def get_last_tweet(client: tweepy.Client, username: str) -> str | None:
    """Fetch the most recent tweet from a given username. Returns text or None."""
    try:
        user = client.get_user(username=username)
        if not user.data:
            return None
        tweets = client.get_users_tweets(
            id=user.data.id,
            max_results=5,
            exclude=["retweets", "replies"],
        )
        if tweets.data:
            return tweets.data[0].text
    except Exception as e:
        log.warning(f"Could not fetch tweets for @{username}: {e}")
    return None


def post_tweet(client: tweepy.Client, text: str, bot_name: str) -> bool:
    """Post a tweet. Returns True on success."""
    try:
        response = client.create_tweet(text=text)
        tweet_id = response.data["id"]
        log.info(f"[{bot_name}] Posted tweet {tweet_id}: {text[:80]}...")
        return True
    except tweepy.TweepyException as e:
        log.error(f"[{bot_name}] Failed to post tweet: {e}")
        return False


# ── Single bot turn ───────────────────────────────────────────────────────────

def bot_turn(
    model,
    tokenizer,
    device,
    memory: MemoryGraph,
    client: tweepy.Client,
    bot_name: str,
    other_username: str,
    other_client: tweepy.Client,
    fallback_prompts: list[str],
) -> str | None:
    """Run one turn for a bot: read → seed → inject memory → generate → post.

    Returns the generated tweet text, or None if posting failed.
    """
    # 1. Try to seed from the other bot's last tweet
    other_tweet = get_last_tweet(other_client, other_username)
    if other_tweet:
        log.info(f"[{bot_name}] Seeding from @{other_username}: '{other_tweet[:60]}...'")
        base_prompt = seed_prompt_from_tweet(other_tweet)
    else:
        base_prompt = random.choice(fallback_prompts)
        log.info(f"[{bot_name}] No tweet from @{other_username}, using fallback prompt.")

    # 2. Blend memory obsessions into the prompt
    prompt = memory.prompt_injection(base_prompt, blend_weight=0.45)
    log.info(f"[{bot_name}] Prompt: '{prompt}'")

    # 3. Generate
    tweet_text = generate_tweet(
        model, tokenizer, prompt, device,
        temperature=TEMPERATURE,
        top_p=TOP_P,
        repetition_penalty=REPETITION_PENALTY,
        max_new_tokens=MAX_NEW_TOKENS,
    )
    log.info(f"[{bot_name}] Generated ({len(tweet_text)} chars): '{tweet_text}'")

    # 4. Post
    success = post_tweet(client, tweet_text, bot_name)
    if not success:
        return None

    # 5. Update memory
    phrases = memory.remember(tweet_text)
    log.info(f"[{bot_name}] Memory updated. Obsessions: {memory.obsessions(3)}")

    return tweet_text


# ── Main loop ─────────────────────────────────────────────────────────────────

def main():
    log.info("=" * 60)
    log.info("Starting orchestrator")
    log.info("=" * 60)

    # Credentials check
    required_vars = [
        "BOT_A_API_KEY", "BOT_A_API_SECRET",
        "BOT_A_ACCESS_TOKEN", "BOT_A_ACCESS_TOKEN_SECRET",
        "BOT_A_USERNAME",
        "BOT_B_API_KEY", "BOT_B_API_SECRET",
        "BOT_B_ACCESS_TOKEN", "BOT_B_ACCESS_TOKEN_SECRET",
        "BOT_B_USERNAME",
    ]
    missing = [v for v in required_vars if not os.getenv(v)]
    if missing:
        log.error(f"Missing environment variables: {missing}")
        log.error("Copy .env.example to .env and fill in your credentials.")
        sys.exit(1)

    bot_a_username = os.environ["BOT_A_USERNAME"]
    bot_b_username = os.environ["BOT_B_USERNAME"]

    # Load models (both on MPS/CPU — they share the same device)
    device = get_device()
    log.info(f"Device: {device}")

    log.info("Loading Bot A model...")
    model_a, tokenizer_a = load_model(MODEL_A_PATH, device)

    log.info("Loading Bot B model...")
    model_b, tokenizer_b = load_model(MODEL_B_PATH, device)

    # Memory graphs
    memory_a = MemoryGraph(MEMORY_A_PATH, bot_name="Bot A")
    memory_b = MemoryGraph(MEMORY_B_PATH, bot_name="Bot B")

    # Twitter clients
    log.info("Authenticating Twitter clients...")
    client_a = make_twitter_client("BOT_A")
    client_b = make_twitter_client("BOT_B")
    log.info("Twitter authenticated.")

    cycle = 0

    while True:
        cycle += 1
        log.info(f"\n{'─' * 50}")
        log.info(f"Cycle {cycle} — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        log.info(f"{'─' * 50}")

        # Bot A speaks
        bot_turn(
            model_a, tokenizer_a, device, memory_a,
            client_a, "Bot A", bot_b_username, client_b,
            BOT_A_FALLBACK_PROMPTS,
        )

        # Brief pause between the two posts so they don't land simultaneously
        time.sleep(random.randint(30, 90))

        # Bot B responds
        bot_turn(
            model_b, tokenizer_b, device, memory_b,
            client_b, "Bot B", bot_a_username, client_a,
            BOT_B_FALLBACK_PROMPTS,
        )

        # Sleep until next cycle (with jitter so it feels organic)
        jitter     = random.randint(-CYCLE_JITTER, CYCLE_JITTER)
        sleep_time = max(60, CYCLE_SLEEP + jitter)
        wake_at    = datetime.fromtimestamp(time.time() + sleep_time).strftime("%H:%M:%S")
        log.info(f"\nSleeping {sleep_time // 60}m {sleep_time % 60}s — next cycle at {wake_at}")
        time.sleep(sleep_time)


if __name__ == "__main__":
    main()
