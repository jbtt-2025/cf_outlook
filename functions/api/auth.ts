/**
 * WebCrypto 原生密码加盐哈希与 JWT 身份认证模块
 * 适用于 Cloudflare Workers / Pages 边缘运行时，零第三方依赖
 */

const JWT_DEFAULT_SECRET = 'CF_OUTLOOK_JWT_SESSION_SECRET_KEY_V1';
const JWT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 天有效期
const PBKDF2_ITERATIONS = 100000;

export interface JwtUserPayload {
  sub: string;           // 用户唯一 ID
  username: string;      // 用户名
  role: 'admin' | 'user';// 角色
  exp: number;           // 过期时间戳 (ms)
}

// 1. PBKDF2 密码加盐散列计算
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');

  const enc = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    256
  );

  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return `$pbkdf2$${PBKDF2_ITERATIONS}$${saltHex}$${hashHex}`;
}

// 2. PBKDF2 密码校验
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!storedHash || !storedHash.startsWith('$pbkdf2$')) {
    return false;
  }

  const parts = storedHash.split('$');
  // parts: ['', 'pbkdf2', iterations, saltHex, hashHex]
  if (parts.length !== 5) return false;

  const iterations = parseInt(parts[2], 10);
  const saltHex = parts[3];
  const expectedHashHex = parts[4];

  // hex to Uint8Array
  const salt = new Uint8Array(saltHex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []);

  const enc = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: iterations,
      hash: 'SHA-256',
    },
    passwordKey,
    256
  );

  const computedHashHex = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return computedHashHex === expectedHashHex;
}

// 3. JWT 签发
export async function createJwtToken(user: { id: string; username: string; role: 'admin' | 'user' }, secret = JWT_DEFAULT_SECRET): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload: JwtUserPayload = {
    sub: user.id,
    username: user.username,
    role: user.role,
    exp: Date.now() + JWT_TTL_MS,
  };

  const b64Header = base64UrlEncode(JSON.stringify(header));
  const b64Payload = base64UrlEncode(JSON.stringify(payload));
  const content = `${b64Header}.${b64Payload}`;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(content));
  const b64Signature = base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));

  return `${content}.${b64Signature}`;
}

// 4. JWT 验证与解析
export async function verifyJwtToken(token: string, secret = JWT_DEFAULT_SECRET): Promise<JwtUserPayload | null> {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [b64Header, b64Payload, b64Signature] = parts;
  const content = `${b64Header}.${b64Payload}`;

  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    // base64url decode signature
    const sigStr = base64UrlDecode(b64Signature);
    const sigBytes = new Uint8Array(sigStr.length);
    for (let i = 0; i < sigStr.length; i++) {
      sigBytes[i] = sigStr.charCodeAt(i);
    }

    const isValid = await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(content));
    if (!isValid) return null;

    const payloadJson = base64UrlDecode(b64Payload);
    const payload = JSON.parse(payloadJson) as JwtUserPayload;

    if (Date.now() > payload.exp) {
      return null; // 过期
    }

    return payload;
  } catch {
    return null;
  }
}

// 辅助方法：从 HTTP Request 中提取用户
export async function getUserFromRequest(request: Request, secret = JWT_DEFAULT_SECRET): Promise<JwtUserPayload | null> {
  const authHeader = request.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  return verifyJwtToken(token, secret);
}

function base64UrlEncode(str: string): string {
  const enc = new TextEncoder();
  const bytes = enc.encode(str);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const dec = new TextDecoder();
  return dec.decode(bytes);
}
