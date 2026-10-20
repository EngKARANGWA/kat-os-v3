# Deploying KAT OS for free

Total cost: **0 RWF/month**. Everything below uses free services that allow business use.

| Part | Service | Cost |
|---|---|---|
| Server (runs Next.js + Python) | Oracle Cloud "Always Free" VM | Free, no expiry |
| Database | Neon free plan (current one), or PostgreSQL on the same server | Free |
| Web address | DuckDNS subdomain, e.g. `katos.duckdns.org` | Free |
| HTTPS certificate | Let's Encrypt (automatic through Caddy) | Free |
| Emails (optional) | Resend free plan (3,000 emails/month) | Free |

> Oracle asks for a bank card **for identity verification only**. Stay on resources marked **"Always Free"** and nothing is charged. Do **not** click "Upgrade to Pay As You Go".

---

## Option A: Oracle Cloud Always Free (recommended)

### 1. Create the server
1. Sign up at https://www.oracle.com/cloud/free/. For the home region (it can't be changed later), choose **US East (Ashburn)**.
   Your Neon database is in AWS **us-east-2 (Ohio)**, so the server will be close to it. That matters for speed: a page needs up to about 10 database queries.
   From a PC in Kigali, each query takes 350–900 ms to reach Ohio, so a page takes several seconds. From a server next to the database, each takes about 1–15 ms,
   so staff only wait for one trip from Kigali to the server per page.
   (If you choose a different region, such as Johannesburg, use the database on the same server instead of Neon. See "Database choices" below.)
2. **Compute → Instances → Create instance**
   - Image: **Ubuntu 22.04** or newer
   - Shape: **Ampere VM.Standard.A1.Flex**, 2 OCPU and 12 GB RAM (inside the free limit of 4 OCPU / 24 GB)
     - If Oracle says "out of capacity", try again later or pick **VM.Standard.E2.1.Micro** (also free, 1 GB RAM; see the note in step 4).
   - Add your SSH key (download the generated one).
3. Note the **public IP address** of the instance.

### 2. Open ports 80 and 443
1. In Oracle: **Instance → Subnet → Security List → Add Ingress Rules**
   - Source `0.0.0.0/0`, TCP, destination port `80`
   - Source `0.0.0.0/0`, TCP, destination port `443`
2. On the server (Oracle's Ubuntu image also blocks these ports in its own firewall):
   ```
   ssh ubuntu@YOUR_IP
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
   sudo netfilter-persistent save
   ```

### 3. Get a free web address
1. Go to https://www.duckdns.org, sign in, and create a subdomain such as `katos`.
2. Put the server's public IP in it and click **update ip**.
   Your address is now `katos.duckdns.org`.

### 4. Install Docker and start KAT OS
```
# On the server
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker

git clone YOUR_REPO_URL kat-os && cd kat-os
cp .env.example .env
nano .env        # fill in KAT_DOMAIN, KAT_SECRET_KEY, DATABASE_URL, admin login
docker compose up -d --build
```
After a few minutes, open `https://katos.duckdns.org`. The HTTPS certificate is created automatically on the first visit.

**Only on the 1 GB "Micro" server:** add swap space before building, or the build can run out of memory:
```
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 5. Updating to a new version
```
cd kat-os
git pull
docker compose up -d --build
```

### Database choices
- **Keep Neon (easiest):** paste the Neon connection string into `DATABASE_URL`. Your existing data is used as-is.
- **Database on the same server:** in `.env` set
  `DATABASE_URL=postgresql://kat:CHANGE_ME@db:5432/kat_os` and `POSTGRES_PASSWORD=CHANGE_ME`, then start with
  `docker compose --profile localdb up -d --build`.
  Make regular backups:
  `docker compose exec db pg_dump -U kat kat_os > backup-$(date +%F).sql`

---

## Option B: a computer in the shop

Works the same way on any PC that stays on (Windows with Docker Desktop, or Linux):
1. Install Docker (Docker Desktop is free for small businesses).
2. In `.env` set `KAT_DOMAIN=:80` and `KAT_COOKIE_SECURE=0`.
3. Run `docker compose up -d --build`.
4. Staff open `http://PC-IP-ADDRESS` (for example `http://192.168.1.20`) from any device on the shop Wi-Fi.

---

## Useful commands
```
docker compose ps                  # is everything running?
docker compose logs -f api         # Python API logs
docker compose logs -f web         # Next.js logs
docker compose restart             # restart everything
```
Health check: `https://YOUR_DOMAIN/api/healthz` should show `{"status":"ok"}`.
