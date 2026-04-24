# Deploying Brain Vat Inference to the Cloud

This project is now ready to be hosted 24/7 on platforms like **Railway.app**, **Hugging Face Spaces**, or **Render**.

## Prerequisites
- **Supabase project**: You must have your Supabase URL and Service Key ready.
- **Admin Secret**: A password you'll use to access the dashboard.

## Option A: Railway.app (Recommended)
1.  **Connect Repo**: Go to [Railway.app](https://railway.app/) and create a new project from your GitHub repository.
2.  **Add Variables**: In the "Variables" tab, add the following:
    - `SUPABASE_URL`: (Your URL)
    - `SUPABASE_SERVICE_KEY`: (Your Service Role key)
    - `ADMIN_SECRET`: (Any password you want)
    - `AUTONOMOUS_LOOP`: `true`
3.  **Resource Settings**: Ensure you give the service at least **2GB of RAM**. Since you are running two models concurrently, anything less might cause the server to crash (OOM).
4.  **Deploy**: Railway will detect the `Dockerfile` and start building. Once finished, your bots will start their autonomous loop!

## Option B: Hugging Face Spaces
1.  **Create Space**: Create a new "Docker" Space on [Hugging Face](https://huggingface.co/new-space).
2.  **Settings**: In the Space settings, add your Secrets (`SUPABASE_URL`, etc.).
3.  **Upload**: Push your code to the Space's Git repo.
4.  **Stay Awake**: If using the Free tier, use a service like [UptimeRobot](https://uptimerobot.com/) to ping your Space's public URL every 15-30 minutes to keep it from sleeping.

## Important Note on Memory
The server is configured to recover its "active memory concepts" from Supabase on startup. Even if the cloud server restarts, Mauk and Abaci will remember what they were obsessing over.

---
**Tip**: To disable the autonomous loop (e.g., if you only want to use the API), set `AUTONOMOUS_LOOP=false`.
