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

  // 3. 测试 auth & captcha
  const tempAuthOut = path.resolve('tests/.temp_auth_test.mjs');
  try {
    await esbuild.build({
      entryPoints: ['tests/auth_captcha.test.ts'],
      bundle: true,
      platform: 'node',
      format: 'esm',
      outfile: tempAuthOut,
      logLevel: 'error',
    });

    await import('file://' + tempAuthOut);
  } finally {
    if (fs.existsSync(tempAuthOut)) {
      try { fs.unlinkSync(tempAuthOut); } catch {}
    }
  }

  // 4. 测试 D1 数据库、多用户权限隔离与凭证滚动写回
  const tempD1Out = path.resolve('tests/.temp_d1_test.mjs');
  try {
    await esbuild.build({
      entryPoints: ['tests/d1_auth_flow.test.ts'],
      bundle: true,
      platform: 'node',
      format: 'esm',
      outfile: tempD1Out,
      logLevel: 'error',
    });

    await import('file://' + tempD1Out);
  } finally {
    if (fs.existsSync(tempD1Out)) {
      try { fs.unlinkSync(tempD1Out); } catch {}
    }
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
