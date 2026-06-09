#!/bin/sh
set -e

echo "[dev] Fixing storage permissions..."
chmod -R 777 storage bootstrap/cache 2>/dev/null || true

echo "[dev] Installing Composer dependencies..."
composer install --no-interaction

# Deteksi first run: jika flag file belum ada, jalankan fresh migration + seed.
# Flag file ada di storage/ yang dipersist oleh volume (./backend di host).
# Untuk reset DB: hapus storage/.docker_initialized lalu restart backend.
#   rm backend/storage/.docker_initialized
#   docker compose restart backend
if [ ! -f storage/.docker_initialized ]; then
    echo "[dev] First run — running migrate:fresh --seed..."
    php artisan migrate:fresh --seed --force
    touch storage/.docker_initialized
    echo "[dev] Database seeded."
else
    echo "[dev] Running pending migrations..."
    php artisan migrate --force
fi

echo "[dev] Starting php artisan serve on 0.0.0.0:8000..."
exec php artisan serve --host=0.0.0.0 --port=8000
