import { execSync } from 'child_process';
import esbuild from 'esbuild';
import path from 'path';
import fs from 'fs';

async function run() {
  console.log('🧪 正在执行单元测试...');
  
  // 1. 测试 deadMarkers
  console.log('\n--- 1. 测试死号匹配逻辑 ---');
  await import('./deadMarkers.test.ts');

  // 2. 测试 codeParser (通过 esbuild 动态编译，兼容所有 Node 18/20/22/24 版本)
  console.log('\n--- 2. 测试验证码解析引擎 ---');
  const tempOut = path.resolve('tests/.temp_codeParser_test.mjs');
  try {
    await esbuild.build({
      entryPoints: ['tests/codeParser.test.ts'],
      bundle: true,
      platform: 'node',
      format: 'esm',
      outfile: tempOut,
      logLevel: 'error',
    });

    // 动态执行编译后的测试
    await import('file://' + tempOut);
  } finally {
    if (fs.existsSync(tempOut)) {
      try { fs.unlinkSync(tempOut); } catch {}
    }
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
