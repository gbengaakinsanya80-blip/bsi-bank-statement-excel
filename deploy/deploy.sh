#!/usr/bin/env bash
#
# BSI — one-shot deployment script for Ubuntu/Debian VPS.
#
# What it does:
#   1. Installs system deps (Python venv, Node 20, Nginx, Certbot).
#   2. Copies the project into /opt/bsi (unless already there).
#   3. Sets up the FastAPI backend as a systemd service on 127.0.0.1:8000.
#   4. Builds the Next.js frontend (NEXT_PUBLIC_API_BASE=/api) and runs it on 127.0.0.1:3000.
#   5. Configures Nginx to reverse-proxy both behind one domain, then installs HTTPS via Certbot.
#
# Usage (run as root, from the deploy/ folder after copying the project to the server):
#   sudo bash deploy.sh app.example.com you@email.com
#
# DOMAIN is required (your domain, or your server's public IP).
# EMAIL is used by Let's Encrypt for the SSL cert (optional but recommended).
set -euo pipefail

DOMAIN="${1:-}"
EMAIL="${2:-}"
if [[ -z "$DOMAIN" ]]; then
  read -rp "Enter your domain or server public IP: " DOMAIN
fi
[[ -z "$DOMAIN" ]] && { echo "ERROR: no domain given." >&2; exit 1; }

APP_DIR="${APP_DIR:-/opt/bsi}"
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="$APP_DIR/backend"
FRONTEND="$APP_DIR/frontend"
SERVICE_USER="bsi"

# ---------------------------------------------------------------------------
log() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }

# ---------------------------------------------------------------------------
# 1. System packages
# ---------------------------------------------------------------------------
log "Installing system packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y --no-install-recommends \
  python3 python3-venv python3-pip python3-dev \
  build-essential libssl-dev libffi-dev \
  curl ca-certificates gnupg rsync \
  nginx certbot python3-certbot-nginx ufw

log "Installing Node.js 20"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
log "node: $(node -v)  npm: $(npm -v)"

# ---------------------------------------------------------------------------
# 2. Copy project files into place
# ---------------------------------------------------------------------------
if [[ "$SRC_DIR" != "$APP_DIR" ]]; then
  log "Copying project to $APP_DIR"
  mkdir -p "$APP_DIR"
  rsync -a \
    --exclude '.venv' --exclude '__pycache__' --exclude '.pytest_cache' \
    --exclude 'node_modules' --exclude '.next' --exclude '.git' \
    --exclude 'backend/data' --exclude '*.log' \
    "$SRC_DIR/" "$APP_DIR/"
fi

# Dedicated service user (www-data-like, no shell)
id -u "$SERVICE_USER" >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin "$SERVICE_USER"

# ---------------------------------------------------------------------------
# 3. Backend (FastAPI)
# ---------------------------------------------------------------------------
log "Setting up Python backend"
python3 -m venv "$BACKEND/.venv"
# shellcheck disable=SC1091
source "$BACKEND/.venv/bin/activate"
python -m pip install --upgrade pip
if ! pip install -r "$BACKEND/requirements.txt"; then
  log "pip failed on OCR packages — retrying without onnxruntime/rapidocr (scanned-PDF OCR disabled)"
  pip install -r "$BACKEND/requirements.txt" || true
  pip uninstall -y onnxruntime rapidocr paddleocr >/dev/null 2>&1 || true
fi
mkdir -p "$BACKEND/data"
chown -R "$SERVICE_USER:$SERVICE_USER" "$APP_DIR"

cat > /etc/systemd/system/bsi-backend.service <<EOF
[Unit]
Description=BSI Backend (FastAPI)
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$BACKEND
Environment=BSI_DATA_DIR=$BACKEND/data
ExecStart=$BACKEND/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

# ---------------------------------------------------------------------------
# 4. Frontend (Next.js)
# ---------------------------------------------------------------------------
log "Building Next.js frontend (NEXT_PUBLIC_API_BASE=/api)"
npm install --prefix "$FRONTEND" --no-audit --no-fund
NEXT_PUBLIC_API_BASE=/api npm run --prefix "$FRONTEND" build

cat > /etc/systemd/system/bsi-frontend.service <<EOF
[Unit]
Description=BSI Frontend (Next.js)
After=network.target bsi-backend.service

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$FRONTEND
ExecStart=/usr/bin/npm start --prefix $FRONTEND -- -p 3000
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

log "Starting services"
systemctl daemon-reload
systemctl enable --now bsi-backend.service
systemctl enable --now bsi-frontend.service
sleep 5
systemctl --no-pager status bsi-backend.service | sed -n '1,5p' || true
systemctl --no-pager status bsi-frontend.service | sed -n '1,5p' || true

# ---------------------------------------------------------------------------
# 5. Nginx reverse proxy
# ---------------------------------------------------------------------------
log "Configuring Nginx"
cat > /etc/nginx/sites-available/bsi <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    client_max_body_size 50m;
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF
ln -sf /etc/nginx/sites-available/bsi /etc/nginx/sites-enabled/bsi
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# ---------------------------------------------------------------------------
# 6. HTTPS via Let's Encrypt
# ---------------------------------------------------------------------------
if [[ -n "$EMAIL" ]]; then
  log "Installing SSL certificate for $DOMAIN"
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect || \
    log "Certbot failed — site still works on HTTP; run 'certbot --nginx -d $DOMAIN' manually."
else
  log "No email given — skipping SSL. Run later:  certbot --nginx -d $DOMAIN"
fi

# ---------------------------------------------------------------------------
# 7. Firewall
# ---------------------------------------------------------------------------
log "Configuring firewall (SSH/HTTP/HTTPS)"
ufw allow OpenSSH >/dev/null 2>&1 || true
ufw allow 'Nginx Full' >/dev/null 2>&1 || true
printf 'y\n' | ufw enable >/dev/null 2>&1 || true
ufw status

# ---------------------------------------------------------------------------
# 8. Health check
# ---------------------------------------------------------------------------
log "Waiting for backend health check..."
for i in $(seq 1 15); do
  if curl -fsS "http://127.0.0.1:8000/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done
echo "Backend  : $(curl -fsS http://127.0.0.1:8000/api/health || echo 'checking...')"
echo
log "DONE. Your app should be live at:"
echo "    http://$DOMAIN      (https://$DOMAIN once Certbot finishes)"
echo
echo "Useful commands:"
echo "    systemctl status bsi-backend bsi-frontend    # service status"
echo "    journalctl -u bsi-backend -f                 # backend logs"
echo "    journalctl -u bsi-frontend -f                # frontend logs"
echo "    sudo certbot --nginx -d $DOMAIN              # (re)install HTTPS"
