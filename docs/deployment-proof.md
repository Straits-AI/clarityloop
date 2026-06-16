# Alibaba Cloud Deployment Proof

- **Provider:** Alibaba Cloud ECS, region <REGION>, instance <INSTANCE_ID>
- **Public endpoint:** http://<ECS_PUBLIC_IP>:8080
- **Health check:** `curl http://<ECS_PUBLIC_IP>:8080/health` -> `{"status":"ok"}` (screenshot below)
- **Live Qwen call from Alibaba:** `curl http://<ECS_PUBLIC_IP>:8080/qwen/ping` -> reply containing `ok`
- **Model Studio:** Qwen models accessed via DashScope from the deployed container.

![ECS console](./img/ecs-console.png)
![Health response](./img/health-curl.png)

> Status: PENDING — fill in the bracketed values and add the two screenshots under docs/img/ after executing infra/deploy-ecs.md against the Phase 0 ECS instance.
