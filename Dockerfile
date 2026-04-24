# Use a lightweight Python base image
FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy model checkpoints into the image
# (This makes the image large but self-contained)
COPY model_checkpoint_abaci_1/ ./model_checkpoint_abaci_1/
COPY model_checkpoint_mauk_1/ ./model_checkpoint_mauk_1/

# Copy the application code
COPY convo_bots/ ./convo_bots/

# Set environment variables
ENV PYTHONPATH="/app/convo_bots:$PYTHONPATH"
ENV PORT=5001
ENV AUTONOMOUS_LOOP=true

# Expose the port
EXPOSE 5001

# Command to run the application
CMD ["python", "convo_bots/server.py"]
