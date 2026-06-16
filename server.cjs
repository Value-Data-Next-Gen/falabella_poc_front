// Azure App Service (Node) — serve the Vite build AND proxy /api to the backend
// so the browser talks to ONE origin (required for the SameSite=lax session
// cookie that v2 uses for auth).
const path = require('path');
const express = require('express');
const compression = require('compression');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = parseInt(process.env.PORT || '8080', 10);
const DIST = path.join(__dirname, 'dist');
const API_TARGET = process.env.API_PROXY_TARGET
  || 'https://poc-fal-back-hrgccdc4hub8fuea.brazilsouth-01.azurewebsites.net';

app.disable('x-powered-by');
// http-proxy-middleware v3: use pathFilter (NOT an express mount path) so the
// full `/api/...` prefix is preserved when forwarding. An express mount path
// gets stripped, turning /api/v1/health into /v1/health -> backend 404.
app.use(createProxyMiddleware({
  pathFilter: '/api',
  target: API_TARGET,
  changeOrigin: true,
  cookieDomainRewrite: '',   // host-only cookie scoped to THIS frontend origin
  xfwd: true,
}));
app.use(compression());
app.use(express.static(DIST, {
  maxAge: '1y', etag: true,
  setHeaders: (res, p) => { if (p.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache'); },
}));
app.get('*', (_req, res) => res.sendFile(path.join(DIST, 'index.html')));
app.listen(PORT, () => console.log(`[server] :${PORT} dist=${DIST} /api->${API_TARGET}`));
