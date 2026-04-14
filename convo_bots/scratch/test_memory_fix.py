
import sys
import os
from pathlib import Path

# Add the convo_bots directory to sys.path
sys.path.append(str(Path(__file__).parent.parent))

from memory_graph import MemoryGraph, _extract_salient_phrases

def test_fix():
    print("Testing MemoryGraph.curate_and_remember fix...")
    
    # Initialize with a dummy path and no model (fallback path)
    mg = MemoryGraph("/tmp/test_memory.json", bot_name="TestBot", bot_key="t")
    
    test_text = "the moon is an open set and I cannot find its boundary"
    
    try:
        added = mg.curate_and_remember(test_text)
        print(f"Success! Added concepts: {added}")
        print(f"Graph now has {len(mg._concepts)} concepts.")
        
        # Verify salient extraction worked
        expected = _extract_salient_phrases(test_text)[:3]
        for p in expected:
            if p in mg._concepts:
                print(f"Verified: '{p}' is in concepts.")
            else:
                print(f"Failed: '{p}' missing from concepts.")
                
    except NameError as e:
        print(f"FAILED: NameError still present: {e}")
    except Exception as e:
        print(f"FAILED: Unexpected error: {e}")

if __name__ == "__main__":
    test_fix()
