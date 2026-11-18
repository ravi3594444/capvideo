import 'dotenv/config';
import express from 'express';
import app from './backend/app.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir, { extensions: ['html'] }));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Caption Lite server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
