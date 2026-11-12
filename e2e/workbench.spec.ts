import { test, expect } from '@playwright/test';

test.describe('Outlook Graph Fullstack Workbench E2E', () => {

  test.beforeEach(async ({ page }) => {
    // 访问工作台主页
    await page.goto('/');
    // 快速清空本地数据库
    await page.evaluate(async () => {
      const reset = (window as any).__resetDB;
      if (reset) await reset();
    });
    await page.reload();
    await expect(page.locator('text=Outlook Graph 批量工作台')).toBeVisible();
  });

  test('1. Workbench layout, polling interval defaults to 180s and can be configured, and dark mode toggle', async ({ page }) => {
    // 检查页面标题与品牌标识
    await expect(page.locator('text=Outlook Graph 批量工作台')).toBeVisible();
    await expect(page.locator('text=Cloudflare Pages Fullstack')).toBeVisible();

    // 检查三栏结构存在
    // 栏 1：侧边导航
    await expect(page.locator('text=当前工作空间')).toBeVisible();
    await expect(page.locator('text=资产健康看板')).toBeVisible();
    await expect(page.getByRole('button', { name: '收件箱', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /验证码雷达/ })).toBeVisible();

    // 检查自动拉取周期：默认 180S
    const intervalInput = page.locator('input[type="number"]');
    await expect(intervalInput).toBeVisible();
    await expect(intervalInput).toHaveValue('180');

    // 测试预设周期按钮（例如点击 300s）
    await page.click('button:has-text("300s")');
    await expect(intervalInput).toHaveValue('300');
    await expect(page.locator('text=已设置自动拉取周期为 300 秒')).toBeVisible();

    // 测试手动输入修改周期为 60
    await intervalInput.fill('60');
    await intervalInput.dispatchEvent('change');
    await expect(intervalInput).toHaveValue('60');

    // 栏 2：邮件列表搜索框
    await expect(page.locator('input[placeholder*="搜索发件人"]')).toBeVisible();

    // 栏 3：正文占位提示
    await expect(page.locator('text=在列表中选择一封邮件，即可在此查看正文与验证码')).toBeVisible();

    // 测试暗黑模式切换
    const html = page.locator('html');
    const themeBtn = page.locator('button[title*="模式"]');
    await expect(themeBtn).toBeVisible();

    // 点击切换暗黑模式
    await themeBtn.click();
    await expect(html).toHaveClass(/dark/);

    // 再次点击切回亮色模式
    await themeBtn.click();
    await expect(html).not.toHaveClass(/dark/);
  });

  test('2. Batch import credentials with multi-format parsing & live preview', async ({ page }) => {
    // 点击「批量导入凭证」按钮
    await page.getByRole('button', { name: /批量导入凭证/ }).click();

    // 检查模态框展示
    await expect(page.locator('text=批量导入 Outlook 凭证')).toBeVisible();

    // 输入测试凭证文本（多种格式混排）
    const sampleInput = [
      'alice@example.com----Password123----M.R3_BAY.sample_refresh_token_alice_12345',
      'bob@example.com----Password456----client-id-custom----M.R3_BAY.sample_refresh_token_bob_67890',
      'carol@example.com----M.R3_BAY.sample_refresh_token_carol_99999'
    ].join('\n');

    await page.fill('textarea[placeholder*="支持以下任意格式"]', sampleInput);

    // 验证实时解析计数
    await expect(page.locator('text=已解析 3 个账号')).toBeVisible();
    await expect(page.locator('td:has-text("alice@example.com")')).toBeVisible();
    await expect(page.locator('td:has-text("bob@example.com")')).toBeVisible();

    // 输入标签
    await page.fill('input[placeholder*="openai, 批次01"]', 'test-tag, e2e-batch');

    // 点击确认导入
    await page.getByRole('button', { name: /确认导入/ }).click();

    // 验证弹窗关闭，且 Toast 提示成功
    await expect(page.locator('text=批量导入 Outlook 凭证')).not.toBeVisible();
    await expect(page.locator('text=成功导入并持久化 3 个账号凭证')).toBeVisible();

    // 验证统计指标显示 3 个邮箱
    await expect(page.locator('text=3 个邮箱')).toBeVisible();
  });

  test('3. Folder navigation, Account Assets Manager & One-click copy email', async ({ page }) => {
    // 先导入一个账号以便测试资产管理
    await page.getByRole('button', { name: /批量导入凭证/ }).click();
    await page.fill(
      'textarea[placeholder*="支持以下任意格式"]',
      'tester@outlook.com----pwd123----M.R3_BAY.mock_refresh_token'
    );
    await page.getByRole('button', { name: /确认导入/ }).click();

    // 切换到「账号资产管理」导航项
    await page.getByRole('button', { name: /账号资产管理/ }).click();

    // 检查全宽资产管理视图
    await expect(page.locator('text=账号资产与状态管理')).toBeVisible();
    await expect(page.locator('td:has-text("tester@outlook.com")')).toBeVisible();
    await expect(page.getByRole('table').getByText('待命')).toBeVisible();

    // 检查一键复制邮箱功能 (行内快捷图标与操作栏独立按钮)
    await expect(page.locator('button[title="一键复制此邮箱"]')).toBeVisible();
    const copyEmailBtn = page.getByRole('button', { name: '复制邮箱', exact: true });
    await expect(copyEmailBtn).toBeVisible();

    // 点击行操作栏「复制邮箱」并验证即时视觉反馈
    await copyEmailBtn.click();
    await expect(page.locator('text=已复制 ✔')).toBeVisible();

    // 点击顶部工具栏「批量复制邮箱」
    const batchCopyBtn = page.getByRole('button', { name: /复制邮箱 \(\d+\)/ });
    await expect(batchCopyBtn).toBeVisible();
    await batchCopyBtn.click();
    await expect(page.locator('text=已复制全部 ✔')).toBeVisible();

    // 检查其他操作按钮（同步、复制 RT、删除）
    await expect(page.locator('button[title="单独拉取该账号"]')).toBeVisible();
    await expect(page.locator('button[title="复制当前最新 Refresh Token"]')).toBeVisible();
    await expect(page.locator('button[title="删除该账号"]')).toBeVisible();

    // 切回收件箱
    await page.getByRole('button', { name: '收件箱', exact: true }).click();
    await expect(page.locator('input[placeholder*="搜索发件人"]')).toBeVisible();
  });

  test('4. Export credentials modal supports multiple formats', async ({ page }) => {
    // 导入 2 个测试账号
    await page.getByRole('button', { name: /批量导入凭证/ }).click();
    await page.fill(
      'textarea[placeholder*="支持以下任意格式"]',
      'user1@test.com----Pass1----M.R3_BAY.token1\nuser2@test.com----Pass2----M.R3_BAY.token2'
    );
    await page.getByRole('button', { name: /确认导入/ }).click();

    // 打开导出凭证弹窗
    await page.getByRole('button', { name: /导出凭证/ }).click();
    await expect(page.locator('text=导出账号与滚动凭证')).toBeVisible();

    // 默认极简两段式预览
    const textarea = page.locator('textarea[readonly]');
    await expect(textarea).toHaveValue(/user1@test\.com----M\.R3_BAY\.token1/);

    // 切换为经典四段式
    const formatSelect = page.locator('select').nth(1);
    await formatSelect.selectOption('four_parts');
    await expect(textarea).toHaveValue(/user1@test\.com----Pass1/);

    // 切换为 JSON Lines
    await formatSelect.selectOption('jsonl');
    await expect(textarea).toHaveValue(/"email":"user1@test\.com"/);

    // 切换为 CSV
    await formatSelect.selectOption('csv');
    await expect(textarea).toHaveValue(/email,password,client_id/);

    // 复制剪贴板按钮可用
    await page.getByRole('button', { name: /复制到剪贴板/ }).click();
    await expect(page.locator('text=已复制到剪贴板 ✔')).toBeVisible();

    // 关闭弹窗
    await page.click('button:has-text("✕")');
    await expect(page.locator('text=导出账号与滚动凭证')).not.toBeVisible();
  });

  test('5. Email item selection, sandboxed iframe display, code radar and headers inspection', async ({ page }) => {
    // 向 IndexedDB 直接注入一封测试邮件和账号
    await page.evaluate(async () => {
      const db = (window as any).__db;
      if (db) {
        await db.accounts.put({
          id: 'test@service.com',
          email: 'test@service.com',
          refresh_token: 'dummy_rt',
          status: 'active',
          unread_count: 1,
          latest_code: '849201',
          latest_code_time: new Date().toISOString(),
          tags: ['openai'],
          created_at: Date.now(),
        });
        await db.emails.put({
          id: 'msg_001',
          account_email: 'test@service.com',
          subject: 'Your OpenAI Verification Code',
          sender_name: 'OpenAI Support',
          sender_address: 'support@openai.com',
          received_at: new Date().toISOString(),
          body_preview: 'Your verification code is 849201. Please enter it within 10 minutes.',
          body_html: '<div style="font-family: Arial;"><h1>OpenAI Verification</h1><p>Your code is <strong style="font-size:24px; color:#2563eb;">849201</strong>.</p></div>',
          extracted_code: '849201',
          is_junk: false,
          is_read: false,
          raw_headers: [
            { name: 'From', value: 'OpenAI Support <support@openai.com>' },
            { name: 'To', value: 'test@service.com' },
            { name: 'X-Spam-Status', value: 'No, score=-1.2' },
          ],
        });
      }
    });

    await page.reload();

    // 检查邮件卡片渲染
    await expect(page.locator('text=Your OpenAI Verification Code')).toBeVisible();
    await expect(page.locator('text=OpenAI Support')).toBeVisible();

    // 检查验证码雷达微卡片
    await expect(page.getByTitle('点击直接复制验证码')).toBeVisible();

    // 切换到「⚡ 验证码」Tab
    await page.getByRole('button', { name: /^⚡ 验证码( \d+)?$/ }).click();
    await expect(page.locator('text=Your OpenAI Verification Code')).toBeVisible();

    // 点击该邮件卡片选中
    await page.locator('text=Your OpenAI Verification Code').click();

    // 检查右侧沙箱阅读面板
    // 1. 验证码大卡片高亮
    await expect(page.locator('text=提取到验证码:')).toBeVisible();
    await expect(page.locator('text=849201').last()).toBeVisible();
    await expect(page.getByRole('button', { name: /一键复制/ })).toBeVisible();

    // 2. iframe 正文沙箱
    const iframe = page.frameLocator('iframe');
    await expect(iframe.locator('h1')).toHaveText('OpenAI Verification');

    // 3. 切换到原始报头检查器
    await page.click('button:has-text("原始报头")');
    await expect(page.locator('text=X-Spam-Status:')).toBeVisible();
    await expect(page.locator('text=No, score=-1.2')).toBeVisible();

    // 4. 切换到纯文本预览
    await page.click('button:has-text("纯文本预览")');
    await expect(page.locator('text=Your verification code is 849201. Please enter it within 10 minutes.').last()).toBeVisible();

    // 5. 标为未读/已读
    await page.click('button:has-text("标为未读")');
    await expect(page.locator('button:has-text("标为已读")')).toBeVisible();
  });
});
