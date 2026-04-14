import torch
from transformers import GPT2LMHeadModel, GPT2Tokenizer
import os

DEVICE = "cpu"  # Force CPU for diagnostic
path_a = "../model_checkpoint_mauk_1"

print(f"Loading model from {path_a} on {DEVICE}...")
tokenizer = GPT2Tokenizer.from_pretrained(path_a)
# Ensure we use native dtype
model = GPT2LMHeadModel.from_pretrained(path_a).to(DEVICE)
model.eval()

prompt = "[MAUK]: the moon is an open set "
inputs = tokenizer(prompt, return_tensors="pt").to(DEVICE)

print("\nGenerating (CPU / No Penalty / Temp 0.8)...")
with torch.no_grad():
    output = model.generate(
        **inputs,
        max_new_tokens=40,
        do_sample=True,
        temperature=0.8,
        top_p=0.95,
        pad_token_id=tokenizer.eos_token_id
    )

print(f"RESULT: {tokenizer.decode(output[0], skip_special_tokens=True)}")

print("\nGenerating (CPU / Penalty 1.3 / Temp 0.9)...")
with torch.no_grad():
    output = model.generate(
        **inputs,
        max_new_tokens=40,
        do_sample=True,
        temperature=0.9,
        top_p=0.95,
        repetition_penalty=1.3,
        pad_token_id=tokenizer.eos_token_id
    )

print(f"RESULT: {tokenizer.decode(output[0], skip_special_tokens=True)}")
