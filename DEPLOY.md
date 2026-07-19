# Deploying to a DigitalOcean droplet

Stack: Nginx (reverse proxy + static/media) → Gunicorn (app server, unix
socket) → Django, managed by systemd. SQLite stays the database — fine at
this traffic level, and it's one file to back up.

Assumes a fresh Ubuntu droplet (22.04/24.04) with root/sudo SSH access, and
(optionally) a domain already pointed at the droplet's IP via an A record.
Replace `example.com` and the `pizzapitch` username below with your own
throughout — they also appear in `deploy/pizzapitch.service` and
`deploy/nginx.conf`, so edit those too if you change them.

## 1. Server setup (as root, once)

```bash
apt update && apt upgrade -y
apt install -y python3-venv python3-pip nginx git gettext ufw

# Firewall: SSH + web only
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

# Dedicated, non-root user to run the app
adduser --disabled-password --gecos "" pizzapitch
```

## 2. Get the code (as `pizzapitch`)

```bash
su - pizzapitch
git clone https://github.com/bunyodkh/pizzapitch_new.git app
cd app

python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

## 3. Configure environment

```bash
cp .env.example .env
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

Edit `.env` and fill in:
- `SECRET_KEY` — the value just generated.
- `ALLOWED_HOSTS` — e.g. `example.com,www.example.com`.
- `CSRF_TRUSTED_ORIGINS` — e.g. `https://example.com,https://www.example.com`.
- `TELEGRAM_BOT_TOKEN` / `TELEGRAM_GROUP_CHAT_ID` — copy from your local `.env`.
- Leave `DEBUG=False` and `SECURE_SSL_REDIRECT=False` for now (flip the second after step 6).

## 4. Initialize the app

```bash
mkdir -p media staticfiles
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py compilemessages
python manage.py createsuperuser
```

## 5. Gunicorn as a systemd service

```bash
exit  # back to root/sudo user
cp /home/pizzapitch/app/deploy/pizzapitch.service /etc/systemd/system/pizzapitch.service
systemctl daemon-reload
systemctl enable --now pizzapitch
systemctl status pizzapitch   # should be "active (running)"
```

## 6. Nginx + HTTPS

```bash
cp /home/pizzapitch/app/deploy/nginx.conf /etc/nginx/sites-available/pizzapitch
ln -s /etc/nginx/sites-available/pizzapitch /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# HTTPS certificate (only if your domain's A record already points here)
apt install -y certbot python3-certbot-nginx
certbot --nginx -d example.com -d www.example.com
```

Visit `https://example.com` and confirm the site loads and admin login
works. Then go back to `.env` on the server, set `SECURE_SSL_REDIRECT=True`,
and restart:

```bash
systemctl restart pizzapitch
```

certbot's renewal is installed as a systemd timer automatically
(`systemctl list-timers | grep certbot`) — nothing else to do.

## Redeploying after code changes

```bash
su - pizzapitch
cd app
git pull
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py compilemessages
exit
systemctl restart pizzapitch
```

## Logs & troubleshooting

```bash
journalctl -u pizzapitch -f      # app logs (Django + gunicorn)
nginx -t                          # validate nginx config after edits
tail -f /var/log/nginx/error.log
```

## Backups

The whole database is `db.sqlite3` in the app directory — copy it
(and `media/` for uploaded hero photos) off the droplet regularly, e.g.:

```bash
sqlite3 /home/pizzapitch/app/db.sqlite3 ".backup /home/pizzapitch/backup-$(date +%F).sqlite3"
```
