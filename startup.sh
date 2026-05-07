#!/bin/bash
# Azure App Service (Linux, Node 20 LTS) — startup command
#
# Configura en Azure App Service > Configuration > General settings:
#   - Startup Command: bash startup.sh
#   - SCM_DO_BUILD_DURING_DEPLOYMENT=1  (Oryx hace `npm ci && npm run build`)
#   - WEBSITE_NODE_DEFAULT_VERSION=~20
#   - VITE_API_BASE=https://<backend>.azurewebsites.net/api  (build-time)

set -euo pipefail

# Fallback: si el deploy entregó fuente sin build (zip-deploy con Oryx off),
# compilamos acá. Normalmente Oryx ya dejó dist/ listo.
if [ ! -d dist ]; then
  npm ci
  npm run build
fi

# Servir el build con pm2 + SPA fallback. pm2 ya está preinstalado en
# Azure App Service Linux Node.
exec pm2 serve dist --no-daemon --spa
