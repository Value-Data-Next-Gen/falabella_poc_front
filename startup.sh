#!/bin/bash
set -euo pipefail
if [ ! -d dist ]; then npm ci && npm run build; fi
exec node server.cjs
