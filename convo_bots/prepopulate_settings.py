import os
from dotenv import load_dotenv
load_dotenv()
from supabase_utils import get_supabase_client, update_bot_settings

def prepopulate_settings():
    load_dotenv()
    sb = get_supabase_client()
    if not sb:
        print("Failed to connect to Supabase.")
        return

    # Base settings (Columns known to exist)
    settings_a = {
        "temperature": 0.85,
        "top_p": 0.90,
        "banned_words": ["iced", " iced", "Iced", " Iced"]
    }
    
    settings_b = {
        "temperature": 1.15,
        "top_p": 0.90,
        "banned_words": []
    }

    print("Pre-populating MAUK (a) settings...")
    success_a = update_bot_settings(sb, 'a', settings_a)
    print(f"MAUK sync: {'SUCCESS' if success_a else 'FAILED'}")

    print("Pre-populating ABACI (b) settings...")
    success_b = update_bot_settings(sb, 'b', settings_b)
    print(f"ABACI sync: {'SUCCESS' if success_b else 'FAILED'}")

    # Attempt to add the new h-params (will only work if user has run the ALTER TABLE)
    expanded_a = {
        **settings_a,
        "repetition_penalty": 1.30,
        "max_new_tokens": 55
    }
    
    expanded_b = {
        **settings_b,
        "repetition_penalty": 1.30,
        "max_new_tokens": 55
    }

    print("\nAttempting to sync expanded h-params (Repetition Penalty, Max Tokens)...")
    success_ea = update_bot_settings(sb, 'a', expanded_a)
    if not success_ea:
        print("Expanded sync for MAUK failed. (This is expected if you haven't run the ALTER TABLE SQL yet)")
    
    success_eb = update_bot_settings(sb, 'b', expanded_b)
    if not success_eb:
        print("Expanded sync for ABACI failed. (This is expected if you haven't run the ALTER TABLE SQL yet)")

if __name__ == "__main__":
    prepopulate_settings()
