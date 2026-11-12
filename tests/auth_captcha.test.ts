import assert from 'assert';
import { generateRandomCode, createCaptchaToken, verifyCaptcha, renderCaptchaSvg } from '../functions/api/captcha';
import { hashPassword, verifyPassword, createJwtToken, verifyJwtToken } from '../functions/api/auth';

async function testAuthAndCaptcha() {
  console.log('\n--- 3. 测试防穷举验证码引擎 ---');

  // 1. 验证码文本生成与 SVG 渲染
  const code = generateRandomCode(4);
  assert.strictEqual(code.length, 4, 'Captcha code should have length 4');
  const svg = renderCaptchaSvg(code);
  assert(svg.includes('<svg'), 'SVG output should contain <svg');
  assert(svg.includes('</svg>'), 'SVG output should contain </svg>');
  assert(svg.includes(code[0]), 'SVG should contain the characters');
  console.log('✔ [PASS] SVG Captcha generation and rendering verified.');

  // 2. 验证码签名与校验
  const token = await createCaptchaToken(code);
  assert(token.includes('.'), 'Captcha token should have payload.signature format');

  // 正确校验 (不区分大小写)
  const validUpper = await verifyCaptcha(token, code.toUpperCase());
  assert.strictEqual(validUpper.valid, true, 'Correct uppercase captcha should pass');

  const validLower = await verifyCaptcha(token, code.toLowerCase());
  assert.strictEqual(validLower.valid, true, 'Correct lowercase captcha should pass');

  // 错误输入
  const invalidCode = await verifyCaptcha(token, 'ZZZZ');
  assert.strictEqual(invalidCode.valid, false, 'Wrong captcha code should fail');

  // 篡改 Token
  const tampered = token.slice(0, -4) + 'abcd';
  const tamperedRes = await verifyCaptcha(tampered, code);
  assert.strictEqual(tamperedRes.valid, false, 'Tampered captcha token should fail');
  console.log('✔ [PASS] Stateless HMAC Captcha signing and tampering prevention verified.');

  console.log('\n--- 4. 测试 PBKDF2 密码加盐哈希与 JWT 身份验证 ---');

  // 3. 密码加盐散列
  const password = 'SecretPassword123!';
  const hash = await hashPassword(password);
  assert(hash.startsWith('$pbkdf2$100000$'), 'Hash should match PBKDF2 structure');

  const correctMatch = await verifyPassword(password, hash);
  assert.strictEqual(correctMatch, true, 'Matching password should return true');

  const wrongMatch = await verifyPassword('WrongPassword', hash);
  assert.strictEqual(wrongMatch, false, 'Non-matching password should return false');
  console.log('✔ [PASS] PBKDF2 salt-hash creation and verification passed.');

  // 4. JWT 签发与解析
  const user = { id: 'usr_123', username: 'admin', role: 'admin' as const };
  const jwt = await createJwtToken(user);
  assert.strictEqual(jwt.split('.').length, 3, 'JWT should contain 3 parts');

  const decoded = await verifyJwtToken(jwt);
  assert(decoded !== null, 'JWT verification should succeed');
  assert.strictEqual(decoded?.sub, 'usr_123');
  assert.strictEqual(decoded?.username, 'admin');
  assert.strictEqual(decoded?.role, 'admin');

  // 篡改 JWT
  const tamperedJwt = jwt.slice(0, -6) + 'xxxxxx';
  const decodedTampered = await verifyJwtToken(tamperedJwt);
  assert.strictEqual(decodedTampered, null, 'Tampered JWT must be rejected');
  console.log('✔ [PASS] WebCrypto HMAC JWT creation, claims and verification passed.');
}

testAuthAndCaptcha().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
