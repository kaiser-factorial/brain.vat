import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
import os

path = "../model_checkpoint_mauk_1"
device = torch.device("mps")

print(f"Testing model load from {path}...")
try:
    # Try the original float32 way
    model = AutoModelForCausalLM.from_pretrained(
        path, 
        torch_dtype=torch.float32, 
        device_map="mps"
    )
    # No .half() here
    model.eval()
    tokenizer = AutoTokenizer.from_pretrained(path)
    
    prompt = "[USER] SAYS: \"Hello\""
    inputs = tokenizer(prompt, return_tensors="pt").to(device)
    
    print("Testing forward pass with complex params...")
    with torch.no_grad():
        # Force inputs to match model dtype if they are floats
        for k in inputs:
            if inputs[k].dtype == torch.float:
                inputs[k] = inputs[k].to(torch.float16)
        
        # Add problematic params
        bad_words_ids = [tokenizer.encode(" airport")]
        
        output = model.generate(
            **inputs, 
            max_new_tokens=10,
            repetition_penalty=1.3,
            bad_words_ids=bad_words_ids
        )
        print("Success!")
        print(tokenizer.decode(output[0]))

except Exception as e:
    print(f"FAILED: {e}")
    import traceback
    traceback.print_exc()
