// Express server para Azure App Service Linux (Node 20).
// Sirve el build de Vite (dist/) con SPA fallback.
const path = require('path');
const express = require('express');
const compression = require('compression');

const app = express();
const PORT = parseInt(process.env.PORT || '8080', 10);
const DIST = path.join(__dirname, 'dist');

app.disable('x-powered-by');
app.use(compression());

// Static assets con cache largo (Vite genera hashes en los nombres).
app.use(
  express.static(DIST, {
    maxAge: '1y',
    etag: true,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  })
);

// SPA fallback — cualquier ruta no-asset devuelve index.html.
app.get('*', (_req, res) => {
  res.sendFile(path.join(DIST, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`[server] listening on ${PORT} (serving ${DIST})`);
});
