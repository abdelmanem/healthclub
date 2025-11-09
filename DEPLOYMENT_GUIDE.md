# Health Club POS System - Production Deployment Guide

## Overview

This guide covers deploying the Health Club system to production, including:
- Backend (Django + Gunicorn + Nginx)
- Frontend (React + Nginx)
- Database setup
- Security hardening
- Monitoring and maintenance

## Prerequisites

- Ubuntu 20.04+ server
- Domain name pointing to your server
- SSL certificate (Let's Encrypt recommended)
- PostgreSQL database
- Git repository access

---

## 1. Backend Deployment (Django + Gunicorn + Nginx)

### 1.1 Environment Configuration

Create production environment file:

```bash
# Create environment directory
sudo mkdir -p /etc/healthclub
sudo chown healthclub:healthclub /etc/healthclub

# Create production .env file
sudo nano /etc/healthclub/.env
```

**Production .env file contents:**
```env
# Django Settings
DJANGO_SETTINGS_MODULE=healthclub.settings
DEBUG=False
SECRET_KEY=your-super-secret-key-here-change-this
ALLOWED_HOSTS=your-domain.com,www.your-domain.com,localhost

# Database
DATABASE_URL=postgres://healthclub_user:secure_password@localhost:5432/healthclub_prod

# Security
SECURE_PROXY_SSL_HEADER=HTTP_X_FORWARDED_PROTO,https
SECURE_SSL_REDIRECT=True
SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True
CSRF_TRUSTED_ORIGINS=https://your-domain.com,https://www.your-domain.com

# CORS
CORS_ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com

# Email (configure your SMTP)
EMAIL_HOST=smtp.your-provider.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@your-domain.com
EMAIL_HOST_PASSWORD=your-email-password

# Redis (if using caching/sessions)
REDIS_URL=redis://localhost:6379/0

# Timezone
TIME_ZONE=UTC

# Static/Media
STATIC_ROOT=/var/www/healthclub/static
MEDIA_ROOT=/var/www/healthclub/media

# Logging
LOG_LEVEL=INFO
```

### 1.2 System Packages Installation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y python3-pip python3-venv python3-dev nginx postgresql postgresql-contrib redis-server git curl

# Install Node.js (for frontend build)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

### 1.3 Database Setup

```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE healthclub_prod;
CREATE USER healthclub_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE healthclub_prod TO healthclub_user;
ALTER USER healthclub_user CREATEDB;
\q
```

### 1.4 Application User and Directories

```bash
# Create application user
sudo adduser --system --group healthclub

# Create directories
sudo mkdir -p /var/www/healthclub
sudo mkdir -p /var/log/healthclub
sudo mkdir -p /etc/healthclub

# Set ownership
sudo chown -R healthclub:healthclub /var/www/healthclub
sudo chown -R healthclub:healthclub /var/log/healthclub
sudo chown -R healthclub:healthclub /etc/healthclub
```

### 1.5 Application Deployment

```bash
# Switch to healthclub user
sudo -u healthclub bash

# Navigate to app directory
cd /var/www/healthclub

# Clone repository
git clone https://github.com/your-username/healthclub.git .

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Set up environment
cp /etc/healthclub/.env .env

# Run migrations
python manage.py migrate --noinput

# Collect static files
python manage.py collectstatic --noinput

# Create superuser (optional)
python manage.py createsuperuser

# Exit healthclub user
exit
```

### 1.6 Gunicorn Service Configuration

Create systemd service file:

```bash
sudo nano /etc/systemd/system/healthclub.service
```

**Service file contents:**
```ini
[Unit]
Description=Gunicorn for Healthclub POS System
After=network.target postgresql.service

[Service]
User=healthclub
Group=healthclub
WorkingDirectory=/var/www/healthclub
EnvironmentFile=/etc/healthclub/.env
ExecStart=/var/www/healthclub/venv/bin/gunicorn healthclub.wsgi:application \
    --bind 127.0.0.1:8001 \
    --workers 3 \
    --timeout 120 \
    --keep-alive 2 \
    --max-requests 1000 \
    --max-requests-jitter 100 \
    --access-logfile /var/log/healthclub/gunicorn_access.log \
    --error-logfile /var/log/healthclub/gunicorn_error.log \
    --log-level info
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

**Enable and start service:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable healthclub
sudo systemctl start healthclub
sudo systemctl status healthclub
```

### 1.7 Nginx Configuration

Create Nginx site configuration:

```bash
sudo nano /etc/nginx/sites-available/healthclub
```

**Nginx configuration:**
```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # Client settings
    client_max_body_size 20M;
    client_body_timeout 60s;
    client_header_timeout 60s;
    
    # Static files
    location /static/ {
        alias /var/www/healthclub/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
    
    # Media files
    location /media/ {
        alias /var/www/healthclub/media/;
        expires 1M;
        add_header Cache-Control "public";
    }
    
    # Health check endpoint
    location /health/ {
        proxy_pass http://127.0.0.1:8001/health/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        access_log off;
    }
    
    # API endpoints
    location /api/ {
        proxy_pass http://127.0.0.1:8001/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_redirect off;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
    }
    
    # Admin interface
    location /admin/ {
        proxy_pass http://127.0.0.1:8001/admin/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Main application
    location / {
        proxy_pass http://127.0.0.1:8001/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_redirect off;
    }
}
```

**Enable site and test configuration:**
```bash
sudo ln -s /etc/nginx/sites-available/healthclub /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### 1.8 Health Check Endpoint

Add health check endpoint to Django:

```bash
sudo -u healthclub bash
cd /var/www/healthclub
source venv/bin/activate
```

Create `healthclub/health.py`:
```python
from django.http import JsonResponse
from django.db import connection
from django.core.cache import cache
import time

def health_check(request):
    """Simple health check endpoint"""
    start_time = time.time()
    
    # Check database connection
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        db_status = "ok"
    except Exception as e:
        db_status = f"error: {str(e)}"
    
    # Check cache (if using Redis)
    try:
        cache.set('health_check', 'ok', 10)
        cache_status = "ok" if cache.get('health_check') == 'ok' else "error"
    except Exception as e:
        cache_status = f"error: {str(e)}"
    
    response_time = round((time.time() - start_time) * 1000, 2)
    
    return JsonResponse({
        'status': 'healthy',
        'timestamp': time.time(),
        'response_time_ms': response_time,
        'database': db_status,
        'cache': cache_status,
        'version': '1.0.0'
    })
```

Add to `healthclub/urls.py`:
```python
from django.urls import path
from . import health

urlpatterns = [
    # ... existing patterns ...
    path('health/', health.health_check, name='health_check'),
]
```

---

## 2. Frontend Deployment (React + Nginx)

### 2.1 Frontend Build Configuration

Create production environment file:

```bash
cd /var/www/healthclub/healthclub-frontend
sudo nano .env.production
```

**Frontend .env.production:**
```env
VITE_API_BASE_URL=https://your-domain.com/api
VITE_APP_NAME=Health Club POS
VITE_APP_VERSION=1.0.0
```

### 2.2 Frontend Build Process

```bash
# Install dependencies
npm ci

# Build for production
npm run build

# Create frontend serving directory
sudo mkdir -p /var/www/healthclub-frontend
sudo cp -r build/* /var/www/healthclub-frontend/
sudo chown -R www-data:www-data /var/www/healthclub-frontend
```

### 2.3 Frontend Nginx Configuration

Create separate Nginx configuration for frontend:

```bash
sudo nano /etc/nginx/sites-available/healthclub-frontend
```

**Frontend Nginx configuration:**
```nginx
server {
    listen 80;
    server_name app.your-domain.com;
    
    root /var/www/healthclub-frontend;
    index index.html;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
    
    # Static assets with long cache
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
    
    # API proxy to backend
    location /api/ {
        proxy_pass http://127.0.0.1:8001/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

**Enable frontend site:**
```bash
sudo ln -s /etc/nginx/sites-available/healthclub-frontend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 3. SSL Certificate Setup

### 3.1 Install Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 3.2 Obtain SSL Certificates

```bash
# For backend
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# For frontend
sudo certbot --nginx -d app.your-domain.com
```

### 3.3 Auto-renewal Setup

```bash
sudo crontab -e
# Add this line:
0 12 * * * /usr/bin/certbot renew --quiet
```

---

## 4. Security Hardening

### 4.1 Firewall Configuration

```bash
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw allow from 127.0.0.1 to any port 8001
sudo ufw status
```

### 4.2 Database Security

```bash
sudo nano /etc/postgresql/*/main/postgresql.conf
# Set:
# listen_addresses = 'localhost'
# ssl = on

sudo nano /etc/postgresql/*/main/pg_hba.conf
# Ensure only local connections:
# local   all             all                                     peer
# host    all             all             127.0.0.1/32            md5
```

### 4.3 System Security

```bash
# Disable root login
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no

# Install fail2ban
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

---

## 5. Monitoring and Logging

### 5.1 Log Rotation

Create logrotate configuration:

```bash
sudo nano /etc/logrotate.d/healthclub
```

**Logrotate configuration:**
```
/var/log/healthclub/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 healthclub healthclub
    postrotate
        systemctl reload healthclub
    endscript
}
```

### 5.2 Monitoring Script

Create monitoring script:

```bash
sudo nano /usr/local/bin/healthclub-monitor.sh
```

**Monitoring script:**
```bash
#!/bin/bash

# Health check script
API_URL="https://your-domain.com/health/"
LOG_FILE="/var/log/healthclub/monitor.log"

check_health() {
    response=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL")
    if [ "$response" != "200" ]; then
        echo "$(date): Health check failed - HTTP $response" >> "$LOG_FILE"
        systemctl restart healthclub
        echo "$(date): Restarted healthclub service" >> "$LOG_FILE"
    fi
}

check_health
```

**Make executable and add to cron:**
```bash
sudo chmod +x /usr/local/bin/healthclub-monitor.sh
sudo crontab -e
# Add: */5 * * * * /usr/local/bin/healthclub-monitor.sh
```

---

## 6. Backup Strategy

### 6.1 Database Backup

Create backup script:

```bash
sudo nano /usr/local/bin/healthclub-backup.sh
```

**Backup script:**
```bash
#!/bin/bash

BACKUP_DIR="/var/backups/healthclub"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="healthclub_prod"

mkdir -p "$BACKUP_DIR"

# Database backup
pg_dump -h localhost -U healthclub_user "$DB_NAME" | gzip > "$BACKUP_DIR/db_backup_$DATE.sql.gz"

# Keep only last 7 days of backups
find "$BACKUP_DIR" -name "db_backup_*.sql.gz" -mtime +7 -delete

echo "$(date): Database backup completed" >> /var/log/healthclub/backup.log
```

**Make executable and schedule:**
```bash
sudo chmod +x /usr/local/bin/healthclub-backup.sh
sudo crontab -e
# Add: 0 2 * * * /usr/local/bin/healthclub-backup.sh
```

### 6.2 Media Files Backup

```bash
sudo nano /usr/local/bin/healthclub-media-backup.sh
```

**Media backup script:**
```bash
#!/bin/bash

SOURCE_DIR="/var/www/healthclub/media"
BACKUP_DIR="/var/backups/healthclub/media"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

# Create tar backup
tar -czf "$BACKUP_DIR/media_backup_$DATE.tar.gz" -C "$SOURCE_DIR" .

# Keep only last 7 days
find "$BACKUP_DIR" -name "media_backup_*.tar.gz" -mtime +7 -delete

echo "$(date): Media backup completed" >> /var/log/healthclub/backup.log
```

---

## 7. Deployment Commands

### 7.1 Quick Deployment Checklist

```bash
# Backend deployment
sudo -u healthclub bash -lc 'cd /var/www/healthclub && git pull && source venv/bin/activate && pip install -r requirements.txt && python manage.py migrate --noinput && python manage.py collectstatic --noinput'
sudo systemctl restart healthclub

# Frontend deployment
cd /var/www/healthclub/healthclub-frontend
npm ci
npm run build
sudo cp -r build/* /var/www/healthclub-frontend/
sudo chown -R www-data:www-data /var/www/healthclub-frontend

# Reload Nginx
sudo systemctl reload nginx
```

### 7.2 Rollback Procedure

```bash
# Rollback backend
sudo -u healthclub bash -lc 'cd /var/www/healthclub && git checkout previous-tag && source venv/bin/activate && python manage.py migrate --noinput && python manage.py collectstatic --noinput'
sudo systemctl restart healthclub

# Rollback frontend
cd /var/www/healthclub/healthclub-frontend
git checkout previous-tag
npm ci
npm run build
sudo cp -r build/* /var/www/healthclub-frontend/
```

---

## 8. Troubleshooting

### 8.1 Common Issues

**Service won't start:**
```bash
sudo systemctl status healthclub
sudo journalctl -u healthclub -f
```

**Database connection issues:**
```bash
sudo -u postgres psql -c "SELECT 1"
sudo -u healthclub bash -lc 'cd /var/www/healthclub && source venv/bin/activate && python manage.py dbshell'
```

**Nginx configuration issues:**
```bash
sudo nginx -t
sudo systemctl status nginx
sudo tail -f /var/log/nginx/error.log
```

**Permission issues:**
```bash
sudo chown -R healthclub:healthclub /var/www/healthclub
sudo chown -R www-data:www-data /var/www/healthclub-frontend
```

### 8.2 Performance Monitoring

```bash
# Check system resources
htop
df -h
free -h

# Check service status
sudo systemctl status healthclub nginx postgresql

# Check logs
sudo tail -f /var/log/healthclub/gunicorn_error.log
sudo tail -f /var/log/nginx/access.log
```

---

## 9. Maintenance Tasks

### 9.1 Regular Maintenance

**Weekly tasks:**
- Check disk space: `df -h`
- Review logs: `sudo journalctl -u healthclub --since "1 week ago"`
- Update system packages: `sudo apt update && sudo apt upgrade`

**Monthly tasks:**
- Review backup integrity
- Check SSL certificate expiration: `sudo certbot certificates`
- Update application dependencies

### 9.2 Scaling Considerations

**For high traffic:**
- Increase Gunicorn workers: `--workers 5`
- Add Redis for session storage
- Consider load balancer
- Database connection pooling

**For multiple servers:**
- Use shared storage for media files
- Implement database replication
- Use CDN for static files

---

## 10. Security Checklist

- [ ] SSL certificates installed and auto-renewing
- [ ] Firewall configured (UFW)
- [ ] Database secured (no external access)
- [ ] Strong passwords and secret keys
- [ ] Regular security updates
- [ ] Fail2ban installed
- [ ] Log monitoring enabled
- [ ] Backup strategy implemented
- [ ] Health checks configured
- [ ] Security headers enabled

---

## Conclusion

This deployment guide provides a production-ready setup for the Health Club POS system. Regular monitoring, backups, and security updates are essential for maintaining a stable and secure production environment.

For additional support or custom configurations, refer to the official documentation for Django, Nginx, and PostgreSQL.
