import re
import json
import os

def parse_synthetic_data(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Regex to find <other>...</other> followed by <me>...</me>
    # We use re.DOTALL to match across newlines
    pattern = re.compile(r"(<other>.*?</other>)\s*(<me>.*?</me>)", re.DOTALL)
    
    matches = pattern.findall(content)
    
    dataset = []
    for other_block, me_block in matches:
        # Clean up whitespace between blocks if any
        full_text = f"{other_block.strip()}{me_block.strip()}"
        dataset.append({"text": full_text})
        
    return dataset

def main():
    input_file = "training/qwen/synthetic_thinking_data.txt"
    output_file = "training/qwen/prepared_dataset.jsonl"
    
    if not os.path.exists(input_file):
        print(f"Error: {input_file} not found.")
        return

    print(f"Parsing {input_file}...")
    data = parse_synthetic_data(input_file)
    
    with open(output_file, "w", encoding="utf-8") as f:
        for entry in data:
            f.write(json.dumps(entry) + "\n")
            
    print(f"Successfully prepared {len(data)} entries in {output_file}")

if __name__ == "__main__":
    main()
