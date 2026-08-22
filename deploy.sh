#!/bin/bash
set -e

REPO_URL="https://x-access-token:${GITHUB_TOKEN}@github.com/robertofcx/fenix-import-web.git"

echo "==> Configurando git..."
git config user.email "render-bot@feniximportperu.com"
git config user.name "Render Bot"
git config core.fileMode false

echo "==> Ejecutando generador de productos..."
node generar-productos.js

echo "==> Preparando cambios..."
git add producto/ sitemap.xml

if git diff --cached --quiet; then
  echo "==> Sin cambios reales que subir. Todo al dia."
  exit 0
fi

echo "==> Hay cambios, haciendo commit..."
git commit -m "Auto: regenerar productos $(date '+%Y-%m-%d %H:%M')"

echo "==> Subiendo a GitHub..."
git push "$REPO_URL" HEAD:main

echo "==> Listo."