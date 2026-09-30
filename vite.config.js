import { Buffer } from 'node:buffer'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function apiDevMiddlewarePlugin() {
  return {
    name: 'api-dev-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';
        if (url.startsWith('/api/instagram')) {
          try {
            const rawChunks = [];
            for await (const chunk of req) {
              rawChunks.push(Buffer.from(chunk));
            }
            req.rawBody = Buffer.concat(rawChunks);
            const body = req.rawBody.toString('utf8');
            if (body) {
              try { req.body = JSON.parse(body); } catch { req.body = body; }
            } else {
              req.body = {};
            }

            const parsedUrl = new URL(url, 'http://' + (req.headers.host || 'localhost'));
            req.query = Object.fromEntries(parsedUrl.searchParams.entries());

            if (!res.status) {
              res.status = (code) => {
                res.statusCode = code;
                return res;
              };
            }
            if (!res.json) {
              res.json = (data) => {
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.end(JSON.stringify(data));
              };
            }
            if (!res.send) {
              res.send = (data) => {
                res.end(data);
              };
            }

            if (url.startsWith('/api/instagram-webhook')) {
              const { default: webhookHandler } = await import('./api/instagram-webhook.js');
              return await webhookHandler(req, res);
            } else {
              const { default: instagramHandler } = await import('./api/instagram.js');
              return await instagramHandler(req, res);
            }
          } catch (err) {
            console.error('[API Dev Middleware Error]', err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message }));
            return;
          }
        }
        next();
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), apiDevMiddlewarePlugin()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
  build: {
    sourcemap: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
