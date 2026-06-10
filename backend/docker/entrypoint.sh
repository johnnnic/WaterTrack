#!/bin/sh
set -e

# Cache Laravel config/routes/views at container start
# Must run here (not build time) because APP_KEY comes from ECS environment/Secrets Manager
php artisan config:cache
php artisan route:cache
php artisan view:cache

# If ECS Container Override provides a command (e.g. migrate:fresh --seed),
# run it instead of starting the web server.
if [ "$#" -gt 0 ]; then
    exec "$@"
fi

exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
