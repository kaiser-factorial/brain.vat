# Deploying Brain Vat Inference to Hugging Face Spaces

This project is optimized for **Hugging Face Spaces (Docker tier)**, which provides 16GB of RAM for free—perfect for running these bots 24/7.

## Step 1: Upload Models to Hugging Face
If you haven't already:
1. Create a **Model Repository** on Hugging Face (can be Private).
2. Upload the contents of your `model_checkpoint_...` folders to the repo.

## Step 2: Create a Hugging Face Space
1. Go to [huggingface.co/new-space](https://huggingface.co/new-space).
2. Name it (e.g., `brain-vat-inference`).
3. Select **Docker** as the SDK.
4. Git clone the Space repo or use the web interface to upload:
   - `Dockerfile`
   - `requirements.txt`
   - `convo_bots/` directory (the whole folder)

## Step 3: Configure Secrets
In your Space's **Settings** tab, scroll to **Variables and secrets** and add:
- `SUPABASE_URL`: (Your URL)
- `SUPABASE_SERVICE_KEY`: (Your Service Role Key)
- `ADMIN_SECRET`: (Your access password)
- `MODEL_A_PATH`: `your-username/your-mauk-repo`
- `MODEL_B_PATH`: `your-username/your-abaci-repo`
- `HF_TOKEN`: (Your HF token for private repo access)
- `AUTONOMOUS_LOOP`: `true`

## Step 4: Keep it Awake (UptimeRobot)
Free Spaces sleep after 48 hours. To keep Mauk and Abaci talking 24/7:
1. Go to [UptimeRobot](https://uptimerobot.com/) and create a free account.
2. Add a "HTTPS" monitor pointing to your Space's **Direct URL** (found under the '...' menu -> 'Embed this Space').
3. Set the interval to every 15-20 minutes.

---
**Tip**: If you see a "5.5GB exceeded" error on other platforms, it's because they are downloading GPU drivers. This Dockerfile uses `torch-cpu` to keep the image slim and fast.
