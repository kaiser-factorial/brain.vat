import os
import re
from pathlib import Path
from typing import List, Dict

# Paths
BASE_DIR = Path(__file__).parent
CORPORA_DIR = BASE_DIR / "training" / "corpus"
HISTORY_FILE = BASE_DIR / "conversation.json"

def clean_text(text: str) -> str:
    """Normalize text for better matching."""
    return re.sub(r'[^a-zA-Z0-9\s]', '', text.lower()).strip()

def search_corpora(query: str) -> List[Dict]:
    """Search for a phrase in the training corpora."""
    results = []
    q_clean = clean_text(query)
    
    # Don't search for tiny common words
    if len(q_clean) < 4:
        return []

    for file in CORPORA_DIR.glob("*.txt"):
        try:
            with open(file, "r") as f:
                content = f.read()
                # Simple substring check
                if query.lower() in content.lower():
                    # Find the context (surrounding characters)
                    idx = content.lower().find(query.lower())
                    snippet = content[max(0, idx-100):min(len(content), idx+len(query)+100)]
                    results.append({
                        "source": file.name,
                        "type": "corpus",
                        "snippet": snippet.strip()
                    })
        except:
            continue
    return results

def search_history(query: str) -> List[Dict]:
    """Search for a phrase in the conversation history."""
    import json
    results = []
    if not HISTORY_FILE.exists():
        return []
        
    try:
        with open(HISTORY_FILE, "r") as f:
            history = json.load(f)
            for msg in history:
                if query.lower() in msg.get("text", "").lower():
                    results.append({
                        "source": "conversation.json",
                        "type": "history",
                        "speaker": msg.get("speaker"),
                        "text": msg.get("text")
                    })
    except:
        pass
    return results

def audit_phrase(phrase: str):
    """Run a full lineage audit on a phrase."""
    print(f"\n--- LINEAGE AUDIT: '{phrase}' ---")
    
    # Try the full phrase
    corpora_hits = search_corpora(phrase)
    history_hits = search_history(phrase)
    
    if not corpora_hits and not history_hits:
        # Try individual unique words if no direct hit
        words = [w for w in phrase.split() if len(w) > 4]
        for word in words[:3]:
            corpora_hits.extend(search_corpora(word))
            
    print(f"\n[CORPUS MATCHES]: {len(corpora_hits)}")
    for hit in corpora_hits[:3]:
        print(f"- {hit['source']}: ...{hit['snippet']}...")

    print(f"\n[HISTORY MATCHES]: {len(history_hits)}")
    for hit in history_hits[:3]:
        print(f"- {hit['speaker']}: {hit['text']}")

if __name__ == "__main__":
    import sys
    test_phrase = sys.argv[1] if len(sys.argv) > 1 else "Log will be resolved"
    audit_phrase(test_phrase)
