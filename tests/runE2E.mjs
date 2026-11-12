import { createServer } from 'vite';
import { spawn } from 'child_process';
import path from 'path';

async function main() {
  console.log('🚀 Starting local Vite dev server for E2E...');
  const server = await createServer({
    configFile: './vite.config.ts',
    server: { port: 5199, host: '127.0.0.1' },
  });
  await server.listen();
  console.log('✔ Test server listening at http://127.0.0.1:5199');

  const cliPath = path.resolve('./node_modules/@playwright/test/cli.js');
  const pw = spawn(process.execPath, [cliPath, 'test'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      BASE_URL: 'http://127.0.0.1:5199',
    },
  });

  pw.on('close', async (code) => {
    console.log(`\nPlaywright exited with code ${code}`);
    await server.close();
    process.exit(code || 0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
