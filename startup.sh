#!/bin/bash
# Azure App Service (Linux, Node 20 LTS) — startup command para React/Vite
#
# Configura en Azure App Service > Configuration > General settings:
#   - Startup Command: bash startup.sh
#   - SCM_DO_BUILD_DURING_DEPLOYMENT=1  (Oryx corre npm ci && npm run build)
#   - VITE_API_BASE=/api                (o la URL absoluta del backend)
#
# Alternativa recomendada: desplegar el frontend como **Azure Static Web App**
# (más barato, CDN global, preview environments por PR). En ese caso no se usa
# startup.sh: Static Web App detecta Vite, corre `npm run build` y sirve `dist/`.

set -euo pipefail

# Oryx normalmente ya hizo el build en deploy; hacemos fallback por si llega
# el fuente crudo vía zip-deploy sin build.
if [ ! -d dist ]; then
  npm ci --omit=dev=false
  npm run build
fi

PORT="${PORT:-8080}"

# `serve` es lightweight y respeta SPA fallback (--single).
exec npx --yes serve -s dist -l "${PORT}" --single --no-clipboard
