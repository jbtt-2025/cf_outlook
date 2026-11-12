import { defineConfig, Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';
import fs from 'fs';
import { DatabaseSync } from 'node:sqlite';

function createLocalD1Database(dbPath: string) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');

  return {
    prepare(query: string) {
      let boundValues: any[] = [];
      const stmt = {
        bind(...values: any[]) {
          boundValues = values;
          return stmt;
        },
        async first(colName?: string) {
          const prepared = db.prepare(query);
          const row: any = prepared.get(...boundValues);
          if (!row) return null;
          if (colName) return row[colName] ?? null;
          return row;
        },
        async all() {
          const prepared = db.prepare(query);
          const results = prepared.all(...boundValues);
          return { results, success: true, meta: { changes: 0 } };
        },
        async run() {
          const prepared = db.prepare(query);
          const info = prepared.run(...boundValues);
          return {
            success: true,
            meta: {
              changes: Number(info.changes || 0),
              last_row_id: Number(info.lastInsertRowid || 0),
            },
          };
        },
      };
      return stmt;
    },
    async batch(statements: any[]) {
      const results = [];
      for (const s of statements) {
        results.push(await s.run());
      }
      return results;
    },
    async exec(query: string) {
      db.exec(query);
      return { count: 1, duration: 0 };
    },
  };
}

function cloudflarePagesApiPlugin(): Plugin {
  const dbPath = path.resolve(__dirname, '.wrangler/local-dev.sqlite');
  let localDb: any = null;

  return {
    name: 'vite-plugin-cloudflare-pages-api',
    configureServer(server) {
      if (!localDb) {
        localDb = createLocalD1Database(dbPath);
      }

      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith('/api')) {
          try {
            const protocol = 'http';
            const host = req.headers.host || 'localhost:5173';
            const fullUrl = `${protocol}://${host}${req.url}`;

            let bodyBuffer: Buffer | undefined = undefined;
            if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE') {
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
              env: { DB: localDb },
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
