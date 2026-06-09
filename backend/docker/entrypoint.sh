#!/bin/sh
set -e

# Cache Laravel config/routes/views at container start
# Must run here (not build time) because APP_KEY comes from ECS environment/Secrets Manager
php artisan config:cache
php artisan route:cache
php artisan view:cache

exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
