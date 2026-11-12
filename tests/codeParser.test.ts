import { extractVerificationCode } from '../src/services/codeParser.ts';

function runTests() {
  const cases = [
    {
      name: 'Standard Chinese verification code in text',
      subject: '【微软】您的安全验证码',
      preview: '您的微软账户验证码是 482910。请在 15 分钟内输入。',
      expected: '482910',
    },
    {
      name: 'English OTP verification code',
      subject: 'Your One-Time Passcode for Login',
      preview: 'Use verification code: 928371 to complete your sign in.',
      expected: '928371',
    },
    {
      name: 'HTML styled verification code with font size',
      subject: 'Discord Security Code',
      preview: 'Here is your security code:',
      html: '<div>Please enter code: <strong style="font-size: 24px; letter-spacing: 2px;">582019</strong></div>',
      expected: '582019',
    },
    {
      name: 'Verification code with colons and spaces',
      subject: 'GitHub Authentication Code',
      preview: 'Verification Code: 716294',
      expected: '716294',
    },
    {
      name: 'Avoid false positive of current year 2026',
      subject: 'Microsoft account terms update 2026',
      preview: 'Welcome to 2026! No verification needed.',
      expected: undefined,
    },
    {
      name: 'Alphanumeric verification code (e.g. Steam or AWS)',
      subject: 'Your access code',
      preview: 'Your auth code is: X9K2P4',
      expected: 'X9K2P4',
    },
    {
      name: 'Chinese bracket notification format',
      subject: '登录验证',
      preview: '【OpenAI】验证码 839102，您正在尝试登录。',
      expected: '839102',
    }
  ];

  let passed = 0;
  for (const c of cases) {
    const result = extractVerificationCode(c.subject, c.preview, c.html);
    if (result === c.expected) {
      console.log(`✔ [PASS] ${c.name} => ${result}`);
      passed++;
    } else {
      console.error(`✘ [FAIL] ${c.name} - Expected: ${c.expected}, Got: ${result}`);
    }
  }

  console.log(`\nTests finished: ${passed}/${cases.length} passed.`);
  if (passed !== cases.length) {
    process.exit(1);
  }
}

runTests();
