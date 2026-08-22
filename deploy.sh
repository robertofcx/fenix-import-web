#!/bin/bash
set -e

echo "==> Configurando git..."
git config user.email "render-bot@feniximportperu.com"
git config user.name "Render Bot"

echo "==> Actualizando repo (git pull)..."
git pull origin main

echo "==> Ejecutando generador de productos..."
node generar-productos.js

echo "==> Revisando cambios..."
if [ -z "$(git status --porcelain)" ]; then
  echo "==> Sin cambios que subir. Todo al dia."
  exit 0
fi

echo "==> Hay cambios, haciendo commit..."
git add producto/ sitemap.xml
git commit -m "Auto: regenerar productos $(date '+%Y-%m-%d %H:%M')"

echo "==> Subiendo a GitHub..."
git push "https://x-access-token:${GITHUB_TOKEN}@github.com/robertofcx/fenix-import-web.git" main

echo "==> Listo."