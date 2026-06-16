# Deploy ClarityLoop API to Alibaba ECS

Prereqs: Phase 0 complete (ECS up, Docker installed, ports 22/8080 open).

1. From your laptop, sync the repo to the instance (replace IP):
   `rsync -az --exclude node_modules --exclude .git ./ ubuntu@<ECS_PUBLIC_IP>:~/clarityloop/`
2. SSH in: `ssh ubuntu@<ECS_PUBLIC_IP>`
3. Create `~/clarityloop/.env` with `DASHSCOPE_API_KEY=...` (and `DASHSCOPE_BASE_URL` if China region).
4. Launch: `cd ~/clarityloop && docker compose -f infra/docker-compose.yml --env-file .env up --build -d`
5. Verify from your laptop:
   - `curl -s http://<ECS_PUBLIC_IP>:8080/health` -> `{"status":"ok"}`
   - `curl -s http://<ECS_PUBLIC_IP>:8080/qwen/ping` -> reply containing `ok`
