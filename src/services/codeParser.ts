/**
 * 验证码智能提取解析器 (Verification Code Parser)
 * 能够从邮件标题、纯文本预览和 HTML 内容中精准提取 4-8 位数字或字母验证码
 */

const KEYWORDS = [
  '验证码', '动态码', '校验码', '安全码', '确认码',
  'verification code', 'verify code', 'security code', 'confirmation code',
  'one-time passcode', 'one-time password', 'passcode', 'otp', 'pin',
  'auth code', 'access code'
];

const STOP_WORDS = new Set([
  'here', 'your', 'this', 'from', 'with', 'have', 'when', 'what', 'then',
  'some', 'into', 'only', 'also', 'more', 'mail', 'team', 'code', 'help',
  'user', 'pass', 'view', 'click', 'open', 'send', 'sent', 'read', 'free'
]);

export function extractVerificationCode(subject?: string, bodyPreview?: string, bodyHtml?: string): string | undefined {
  const s = subject || '';
  const preview = bodyPreview || '';
  const textToScan = `${s}\n${preview}`;

  // 1. 显式的单行关键词后跟随验证码（注意：避免跨行匹配英文单词）
  // 例如: "验证码: 123456", "verification code is: 839201", "auth code is: X9K2P4", "OTP: 938102"
  const explicitRegexes = [
    /(?:验证码|动态码|校验码|安全码|确认码|otp|passcode|pin)(?:\s+is|\s*为|\s*是)?[:：\t ]*([A-Za-z0-9]{4,8})\b/i,
    /(?:verification|confirmation|security|auth|access)\s+code(?:\s+is)?[:：\t ]*([A-Za-z0-9]{4,8})\b/i,
    /(?:enter|use|with)\s+(?:code|pin)[:：\t ]*([A-Za-z0-9]{4,8})\b/i,
    /【.+】.*?([0-9]{4,8})/i, // 中文通知短信/邮件格式【某某平台】您的验证码是 123456
    /([0-9]{4,8})\s*(?:为您的|是您的|是本次)/i,
    /(?:code|pin)[:：\t ]+([0-9]{4,8})\b/i,
  ];

  for (const regex of explicitRegexes) {
    const match = textToScan.match(regex);
    if (match && match[1]) {
      const code = match[1].trim();
      if (isValidCandidate(code)) {
        return code;
      }
    }
  }

  // 2. 从 HTML 中分析特殊标签 (如 style 带有大号字体、加粗、特殊字间距的独立数字或特征代码)
  if (bodyHtml) {
    const htmlCode = extractFromHtml(bodyHtml);
    if (htmlCode && isValidCandidate(htmlCode)) {
      return htmlCode;
    }
  }

  // 3. 如果标题或正文明确提示验证码，提取独立出现的 4-8 位纯数字
  const hasKeyword = KEYWORDS.some(k => textToScan.toLowerCase().includes(k.toLowerCase()));
  if (hasKeyword) {
    const numberMatches = textToScan.match(/\b([0-9]{4,8})\b/g);
    if (numberMatches) {
      for (const num of numberMatches) {
        if (isValidCandidate(num)) {
          return num;
        }
      }
    }
  }

  return undefined;
}

function extractFromHtml(html: string): string | undefined {
  // 查找带有明显字体放大或字间距的标签内容
  const patterns = [
    /<(?:span|strong|b|div|p|td|h[1-6])[^>]*style="[^"]*(?:font-size:\s*(?:[2-4]\d|1[89])px|letter-spacing)[^"]*"[^>]*>\s*([A-Za-z0-9]{4,8})\s*<\//i,
    /<(?:span|strong|b|h[1-4])[^>]*>\s*([0-9]{4,8})\s*<\//i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      const val = match[1].trim();
      if (isValidCandidate(val)) {
        return val;
      }
    }
  }

  return undefined;
}

function isValidCandidate(val: string): boolean {
  if (!val || val.length < 4 || val.length > 8) return false;

  // 过滤常用英语停用词
  if (STOP_WORDS.has(val.toLowerCase())) return false;

  // 纯数字检查：避免误判年份 (比如 1990 - 2035)
  if (/^[0-9]{4}$/.test(val)) {
    const n = parseInt(val, 10);
    if (n >= 1990 && n <= 2035) {
      return false;
    }
  }

  // 如果包含字母，但没有数字且全小写，通常是普通单词而非验证码
  if (/^[a-z]+$/.test(val)) {
    return false;
  }

  return true;
}
