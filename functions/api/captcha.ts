/**
 * 边缘防穷举轻量级矢量 SVG 验证码引擎
 * 使用纯 WebCrypto HMAC-SHA256 签名，完全无状态，零外部依赖
 */

const CAPTCHA_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const CAPTCHA_SECRET = 'CF_OUTLOOK_CAPTCHA_SECRET_V1_KEY';
const CAPTCHA_TTL_MS = 5 * 60 * 1000; // 5 分钟有效

// 生成随机验证码文本
export function generateRandomCode(length = 4): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    const idx = Math.floor(Math.random() * CAPTCHA_CHARS.length);
    result += CAPTCHA_CHARS[idx];
  }
  return result;
}

// 获取 WebCrypto HMAC Key
async function getHmacKey(secret = CAPTCHA_SECRET): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

// 签发无状态验证码 ID (payload: CODE:EXPIRES_AT.SIGNATURE)
export async function createCaptchaToken(code: string, secret?: string): Promise<string> {
  const expiresAt = Date.now() + CAPTCHA_TTL_MS;
  const payload = `${code.toUpperCase()}:${expiresAt}`;
  const key = await getHmacKey(secret);
  const enc = new TextEncoder();
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  const signatureHex = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  // base64url encode payload
  const b64Payload = btoa(payload).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64Payload}.${signatureHex}`;
}

// 校验验证码
export async function verifyCaptcha(captchaId: string, userInput: string, secret?: string): Promise<{ valid: boolean; reason?: string }> {
  if (!captchaId || !userInput) {
    return { valid: false, reason: '验证码或凭证不能为空' };
  }

  const parts = captchaId.split('.');
  if (parts.length !== 2) {
    return { valid: false, reason: '无效的验证码签名凭证' };
  }

  const [b64Payload, signatureHex] = parts;

  // 解码 payload
  let payloadStr: string;
  try {
    const padded = b64Payload.replace(/-/g, '+').replace(/_/g, '/');
    payloadStr = atob(padded);
  } catch {
    return { valid: false, reason: '验证码解析错误' };
  }

  const [expectedCode, expiresAtStr] = payloadStr.split(':');
  const expiresAt = Number(expiresAtStr);

  if (Date.now() > expiresAt) {
    return { valid: false, reason: '验证码已过期，请点击重新获取' };
  }

  // 校验 HMAC 签名
  const key = await getHmacKey(secret);
  const enc = new TextEncoder();
  const expectedSigBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(payloadStr));
  const expectedSigHex = Array.from(new Uint8Array(expectedSigBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  if (expectedSigHex !== signatureHex) {
    return { valid: false, reason: '验证码凭证防篡改校验失败' };
  }

  if (expectedCode.toUpperCase() !== userInput.trim().toUpperCase()) {
    return { valid: false, reason: '验证码输入错误' };
  }

  return { valid: true };
}

// 渲染 SVG 矢量字符图形
export function renderCaptchaSvg(text: string, width = 120, height = 40): string {
  const colors = ['#2563eb', '#7c3aed', '#db2777', '#059669', '#d97706', '#4f46e5'];

  let charsSvg = '';
  const charWidth = width / (text.length + 1);

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const x = charWidth * (i + 0.6) + (Math.random() * 4 - 2);
    const y = height / 2 + (Math.random() * 6 - 3) + 6;
    const rotate = (Math.random() * 40 - 20).toFixed(1);
    const fontSize = Math.floor(Math.random() * 4 + 22);
    const color = colors[Math.floor(Math.random() * colors.length)];

    charsSvg += `<text x="${x}" y="${y}" font-family="monospace, sans-serif" font-weight="bold" font-size="${fontSize}" fill="${color}" transform="rotate(${rotate}, ${x}, ${y})" text-anchor="middle">${char}</text>`;
  }

  // 干扰噪点与线条
  let linesSvg = '';
  for (let i = 0; i < 3; i++) {
    const x1 = Math.floor(Math.random() * 20);
    const y1 = Math.floor(Math.random() * height);
    const x2 = Math.floor(width - Math.random() * 20);
    const y2 = Math.floor(Math.random() * height);
    const qx = Math.floor(width / 2 + (Math.random() * 30 - 15));
    const qy = Math.floor(Math.random() * height);
    const color = colors[Math.floor(Math.random() * colors.length)];
    linesSvg += `<path d="M ${x1} ${y1} Q ${qx} ${qy} ${x2} ${y2}" stroke="${color}" stroke-width="1.5" fill="none" opacity="0.45"/>`;
  }

  let dotsSvg = '';
  for (let i = 0; i < 20; i++) {
    const cx = Math.floor(Math.random() * width);
    const cy = Math.floor(Math.random() * height);
    const r = Math.random() * 1.5 + 0.5;
    const color = colors[Math.floor(Math.random() * colors.length)];
    dotsSvg += `<circle cx="${cx}" cy="${cy}" r="${r.toFixed(1)}" fill="${color}" opacity="0.3"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="background-color: #f8fafc; border-radius: 6px; user-select: none;">
    ${dotsSvg}
    ${linesSvg}
    ${charsSvg}
  </svg>`.trim();
}
