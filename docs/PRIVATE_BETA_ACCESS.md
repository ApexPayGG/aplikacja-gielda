# Private beta access (HTTP Basic Auth)

StockAI Pro on **stock-ai.pro** is gated at the **nginx edge** (not in the React app). Visitors must pass HTTP Basic Auth before the SPA or API (except health checks).

Credentials are **never stored in git** — only on the VPS in `.htpasswd`.

---

## How it works

| Traffic | Basic Auth |
|---------|------------|
| `https://stock-ai.pro/` (SPA) | Required |
| `https://stock-ai.pro/api/*` | Required |
| `https://stock-ai.pro/health` | **Public** |
| `https://stock-ai.pro/api/health` | **Public** |
| HTTP → HTTPS redirect (`:80`) | No auth (301 only) |
| `/.well-known/acme-challenge/` | Public (Let's Encrypt) |
| Docker internal (`api:3000`, `frontend:80`) | **Not affected** — only the public nginx container enforces auth |

Config: `nginx-prod.conf` → `auth_basic` + `auth_basic_user_file /etc/nginx/private-beta/.htpasswd`.

Compose mount: `docker-compose.prod.yml` → host `/etc/nginx/private-beta/.htpasswd` → same path inside `stockai-nginx-prod`.

---

## One-time setup on VPS

SSH to the production host (repo deploy directory, e.g. `~/aplikacja-gielda`).

### 1. Create directory (root)

```bash
sudo mkdir -p /etc/nginx/private-beta
sudo chmod 755 /etc/nginx/private-beta
```

### 2. Generate `.htpasswd`

Use a strong password. **Do not paste it into chat, tickets, or git.**

**Option A — `htpasswd` (Apache utils):**

```bash
sudo apt-get install -y apache2-utils   # if missing
sudo htpasswd -c /etc/nginx/private-beta/.htpasswd stockai_beta
# prompts for password twice
```

**Option B — OpenSSL (no extra package):**

```bash
read -s BETA_PASS; echo
HASH=$(openssl passwd -apr1 "$BETA_PASS")
printf 'stockai_beta:%s\n' "$HASH" | sudo tee /etc/nginx/private-beta/.htpasswd
unset BETA_PASS HASH
```

Add more users (without `-c`):

```bash
sudo htpasswd /etc/nginx/private-beta/.htpasswd another_user
```

### 3. Permissions

```bash
sudo chmod 640 /etc/nginx/private-beta/.htpasswd
sudo chown root:root /etc/nginx/private-beta/.htpasswd
```

### 4. Deploy config and restart nginx

```bash
cd ~/aplikacja-gielda   # adjust path
git pull
docker compose -f docker-compose.prod.yml config   # validate YAML
docker compose -f docker-compose.prod.yml up -d nginx
# or: docker compose -f docker-compose.prod.yml restart nginx
```

If `.htpasswd` is missing, nginx will fail to start — create the file before restart.

---

## Verification (curl)

Replace `USER` and `PASS` with your beta credentials.

**Without auth — site should be closed:**

```bash
curl -sI https://stock-ai.pro/ | head -n 1
# Expected: HTTP/2 401  (or HTTP/1.1 401)

curl -sI https://stock-ai.pro/api/companies/search?q=test | head -n 1
# Expected: 401
```

**With auth — SPA / API reachable:**

```bash
curl -sI -u 'USER:PASS' https://stock-ai.pro/ | head -n 1
# Expected: 200

curl -sI -u 'USER:PASS' https://stock-ai.pro/api/companies/search?q=a | head -n 1
# Expected: 200 or 4xx from app logic — not 401 from nginx
```

**Health — always public (no `-u`):**

```bash
curl -si https://stock-ai.pro/api/health | head -n 5
# Expected: HTTP/2 200

curl -si https://stock-ai.pro/health | head -n 5
# Expected: HTTP/2 200
```

Browser: open `https://stock-ai.pro` → login dialog → after success, app and `/api` calls on the same origin reuse credentials.

---

## Rotate password

```bash
sudo htpasswd /etc/nginx/private-beta/.htpasswd stockai_beta
docker compose -f docker-compose.prod.yml restart nginx
```

---

## Disable private beta later (go public)

1. In `nginx-prod.conf`, remove (or comment) these lines from `location /api` and `location /`:
   - `auth_basic "StockAI Pro Private Beta";`
   - `auth_basic_user_file /etc/nginx/private-beta/.htpasswd;`
2. In `docker-compose.prod.yml`, remove the `.htpasswd` volume mount (optional).
3. `git pull` on VPS, `docker compose -f docker-compose.prod.yml up -d nginx`.

Optional: delete `/etc/nginx/private-beta/.htpasswd` on the server.

---

## External webhooks (future)

During private beta, **only** `/health` and `/api/health` are public. Inbound webhooks (e.g. **Stripe** `POST /api/stripe/webhook`) will receive **401** until you add a dedicated `location` without `auth_basic` or open the app. Plan that before enabling live payments.

---

## Security notes

- Use a unique beta password, not the same as admin DB or Stripe.
- Restrict who receives credentials (invite list).
- `.htpasswd` is listed in `.gitignore` — never `git add` it.
- TLS (HTTPS) still required; Basic Auth over plain HTTP is not used on prod (port 80 only redirects).

---

## Related files

| File | Role |
|------|------|
| `nginx-prod.conf` | `auth_basic` on `/` and `/api` |
| `docker-compose.prod.yml` | Mount VPS `.htpasswd` into nginx container |
| `.gitignore` | Ignores `private-beta/.htpasswd`, `.htpasswd` |
