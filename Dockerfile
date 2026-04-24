# Use a lightweight Python base image
FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install CPU-specific Torch (fixes the 5.5GB building bloat issue)
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

# Copy requirements and install the rest
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code
COPY convo_bots/ ./convo_bots/
# Ensure memory directory exists and is writable
RUN mkdir -p /app/convo_bots/memory && chmod -R 777 /app/convo_bots/memory

# Set environment variables
ENV PYTHONPATH="/app/convo_bots:$PYTHONPATH"
ENV HF_HOME="/tmp"
# Hugging Face Spaces use port 7860
ENV PORT=7860
ENV AUTONOMOUS_LOOP=true

# Expose the port
EXPOSE 7860

# Command to run the application
CMD ["python", "convo_bots/server.py"]
