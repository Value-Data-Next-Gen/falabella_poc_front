# Falabella POC — Frontend

React 18 + Vite 5 + TailwindCSS + Deck.gl + Recharts. Dashboard de la torre de control ValueData sobre datos tipo SimpliRoute.

## Correr localmente

```bash
npm ci
npm run dev       # http://localhost:5180
```

El proxy de Vite reenvía `/api/*` a `http://127.0.0.1:8090` (backend). Ajustar en `vite.config.ts` si cambia el puerto.

## Build

```bash
npm run build
npm run preview   # sirve /dist
```

## Azure

Dos opciones de despliegue:

**1. Azure Static Web App (recomendado)** — no necesita `startup.sh`. Conectar el repo, app location = `/`, build = `npm run build`, output = `dist`.

**2. Azure App Service (Linux, Node 20)**:
- Startup Command: `bash startup.sh`
- Application Settings: `SCM_DO_BUILD_DURING_DEPLOYMENT=1`, `VITE_API_BASE=https://<backend>.azurewebsites.net/api`

El `startup.sh` corre `serve -s dist --single` con SPA fallback.
