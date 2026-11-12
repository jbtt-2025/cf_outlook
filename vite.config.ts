import { defineConfig, Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

function cloudflarePagesApiPlugin(): Plugin {
  return {
    name: 'vite-plugin-cloudflare-pages-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith('/api')) {
          try {
            const protocol = 'http';
            const host = req.headers.host || 'localhost:5173';
            const fullUrl = `${protocol}://${host}${req.url}`;

            let bodyBuffer: Buffer | undefined = undefined;
            if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
              const chunks: any[] = [];
              for await (const chunk of req) {
                chunks.push(chunk);
              }
              bodyBuffer = Buffer.concat(chunks);
            }

            const request = new Request(fullUrl, {
              method: req.method,
              headers: req.headers as any,
              body: bodyBuffer && bodyBuffer.length > 0 ? bodyBuffer : undefined,
              // @ts-ignore
              duplex: 'half',
            });

            const routeModule = await server.ssrLoadModule('/functions/api/[[route]].ts');
            const response: Response = await routeModule.onRequest({
              request,
              env: {},
              params: {},
              waitUntil: () => {},
              next: () => Promise.resolve(new Response()),
              data: {},
            });

            res.statusCode = response.status;
            response.headers.forEach((val, key) => {
              res.setHeader(key, val);
            });
            const arrayBuf = await response.arrayBuffer();
            res.end(Buffer.from(arrayBuf));
          } catch (error: any) {
            console.error('[API Dev Proxy Error]', error);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: error?.message || String(error) }));
          }
        } else {
          next();
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [vue(), cloudflarePagesApiPlugin()],
  resolve: {
    preserveSymlinks: true,
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
  },
});
