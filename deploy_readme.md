# Deploying Brain Vat Inference to Hugging Face Spaces

This project is optimized for **Hugging Face Spaces (Docker tier)**, which provides 16GB of RAM for free—perfect for running these bots 24/7.

## Step 1: Upload Models to Hugging Face Hub
If you haven't already:
1. Create a **Model Repository** on Hugging Face (can be Private).
2. Upload the contents of your `model_checkpoint_...` folders to the repo.

## Step 2: Prepare your Deployment Folder
To avoid uploading large local files or private logs, create a dedicated folder on your Desktop:
1. Create a folder named `brain-vat-deploy`.
2. Copy these files/folders into it:
   - `convo_bots/` (folder)
   - `Dockerfile`
   - `requirements.txt`

## Step 3: Deploy via Command Line (Git)
1. Open your Terminal and `cd` into your new folder:
   ```bash
   cd ~/Desktop/brain-vat-deploy
   ```
2. Initialize and push to Hugging Face:
   ```bash
   git init
   git remote add hf https://huggingface.co/spaces/brick-factorial/brain-vat-inference
   git add .
   git commit -m "initial deploy"
   git branch -M main
   git push hf main --force
   ```
   *Note: When asked for a password, use your **HF Access Token**.*

## Step 4: Configure Secrets
In your Space's **Settings** tab, scroll to **Variables and secrets** and add:
- `SUPABASE_URL`: (Your URL)
- `SUPABASE_SERVICE_KEY`: (Your Service Role Key)
- `ADMIN_SECRET`: (Your access password)
- `MODEL_A_PATH`: `your-username/your-mauk-repo`
- `MODEL_B_PATH`: `your-username/your-abaci-repo`
- `HF_TOKEN`: (Your HF token for private repo access)
- `AUTONOMOUS_LOOP`: `true`

## Step 5: Keep it Awake (UptimeRobot)
Free Spaces sleep after 48 hours. To keep Mauk and Abaci talking 24/7:
1. Go to [UptimeRobot](https://uptimerobot.com/).
2. Add a monitor pointing to your **Space's Direct URL** (found under '...' -> 'Embed this Space').
3. Set the interval to every 20 minutes.
