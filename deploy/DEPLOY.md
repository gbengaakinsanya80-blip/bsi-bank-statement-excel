# Deploy BSI to your own VPS

Everything below assumes an **Ubuntu 24.04 / 22.04** (or Debian 12) VPS with a
public IP and a domain name pointed at it. If you only have an IP, it still works —
you'll get `http://<ip>` (no HTTPS).

## Option A — one-command script (recommended)

The repo now contains `deploy/deploy.sh`. Steps:

1. **Get the project onto the server** (run from your PC):

   ```powershell
   scp -r "C:\Users\USER\Desktop\Locally\NEARBY\AI Bank Statement to Excel Converter" root@YOUR_SERVER_IP:/opt/bsi-src
   ```

2. **SSH into the server:**

   ```bash
   ssh root@YOUR_SERVER_IP
   cd /opt/bsi-src/deploy
   ```

3. **Run the installer** (needs root):

   ```bash
   sudo bash deploy.sh app.yourdomain.com you@email.com
   ```

   - `app.yourdomain.com` → your domain (or your server IP).
   - `you@email.com` → for the free SSL certificate (skip → HTTP only).

4. Wait ~5–10 min (it installs Node, Python deps incl. OCR, builds the frontend,
   sets up Nginx + HTTPS, firewall). When it prints `DONE`, open
   `https://app.yourdomain.com`.

## Option B — do it manually

```bash
# 1. System deps
apt update && apt install -y python3 python3-venv python3-pip build-essential \
  nginx certbot python3-certbot-nginx ufw rsync curl
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt install -y nodejs

# 2. Backend
cd /opt/bsi-src/backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
# if pip fails on onnxruntime/rapidocr for your Python version:
.venv/bin/pip install -r requirements.txt; .venv/bin/pip uninstall -y onnxruntime rapidocr paddleocr

# 3. Backend service (systemd)
cat > /etc/systemd/system/bsi-backend.service <<'EOF'
[Unit]
Description=BSI Backend
After=network.target
[Service]
Type=simple
WorkingDirectory=/opt/bsi-src/backend
Environment=BSI_DATA_DIR=/opt/bsi-src/backend/data
ExecStart=/opt/bsi-src/backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload && systemctl enable --now bsi-backend

# 4. Frontend build + service
cd /opt/bsi-src/frontend
npm install
NEXT_PUBLIC_API_BASE=/api npm run build
cat > /etc/systemd/system/bsi-frontend.service <<'EOF'
[Unit]
Description=BSI Frontend
After=bsi-backend.service
[Service]
Type=simple
WorkingDirectory=/opt/bsi-src/frontend
ExecStart=/usr/bin/npm start --prefix /opt/bsi-src/frontend -- -p 3000
Restart=always
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload && systemctl enable --now bsi-frontend

# 5. Nginx (reverse proxy: /api → :8000, everything else → :3000)
cat > /etc/nginx/sites-available/bsi <<'EOF'
server {
    listen 80;
    server_name app.yourdomain.com;
    client_max_body_size 50m;
    location /api/ { proxy_pass http://127.0.0.1:8000; proxy_set_header Host $host; proxy_set_header X-Forwarded-Proto $scheme; }
    location / { proxy_pass http://127.0.0.1:3000; proxy_set_header Host $host; proxy_set_header X-Forwarded-Proto $scheme; }
}
EOF
ln -sf /etc/nginx/sites-available/bsi /etc/nginx/sites-enabled/bsi
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# 6. HTTPS + firewall
certbot --nginx -d app.yourdomain.com --redirect
ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw enable
```

## What you should end up with

| URL | What |
| --- | ---- |
| `https://app.yourdomain.com` | The app UI |
| `https://app.yourdomain.com/api/docs` | FastAPI interactive docs |
| `https://app.yourdomain.com/api/health` | Health check |

## Notes & troubleshooting

- **OCR/scanned statements**: the default `rapidocr` backend is installed if it
  builds on your Python version. First scanned upload downloads ONNX models
  (~10–20 MB) automatically.
- **Big statements / slow OCR**: raise the proxy timeout in the Nginx config
  (`proxy_read_timeout 300s` is set in the script; increase if needed).
- **Service logs**: `journalctl -u bsi-backend -f`, `journalctl -u bsi-frontend -f`.
- **Redploy after code changes**: copy the new files over the server and run
  `systemctl restart bsi-backend`, then rebuild the frontend
  (`cd /opt/bsi-src/frontend && NEXT_PUBLIC_API_BASE=/api npm run build`) and
  `systemctl restart bsi-frontend`.
- **Data**: the SQLite DB + uploaded PDFs live in `backend/data`
  (`BSI_DATA_DIR`). Back it up if it matters to you.
- **DNS**: make sure your domain's `A` record points at the server IP *before*
  running Certbot.
