/**
 * Cloudflare Pages Function: 全栈后端边缘网关
 * 路由：/api/* (同源免 CORS，支持用户注册/认证/管理、防穷举验证码、凭据持久化与滚动刷新)
 */

import type {
  RefreshTokenRequest,
  RefreshTokenResponse,
  MailListRequest,
  MailListResponse,
  GraphMessageItem
} from '../../src/types/api';

import {
  generateRandomCode,
  createCaptchaToken,
  verifyCaptcha,
  renderCaptchaSvg
} from './captcha';

import {
  hashPassword,
  verifyPassword,
  createJwtToken,
  getUserFromRequest
} from './auth';

import {
  initDatabase,
  getUserCount,
  findUserByUsername,
  findUserById,
  createUser,
  listAllUsers,
  updateUser,
  deleteUserAndData,
  listAccountsByUser,
  getAccountById,
  saveAccount,
  saveAccountsBatch,
  updateAccountTags,
  updateAccountSyncResult,
  deleteAccount,
  purgeDeadAccounts,
  listEmailsByUser,
  saveEmails,
  updateEmailReadStatus,
  deleteEmail,
  type DbAccount,
  type DbEmail
} from './db';

import { extractVerificationCode } from '../../src/services/codeParser';

const DEFAULT_CLIENT_ID = "9e5f94bc-e8a4-4e73-b8be-63364c29d753"; // Microsoft Authentication Broker
const FALLBACK_CLIENT_IDS = [
  DEFAULT_CLIENT_ID,
  "d3590ed6-52b3-4102-aeff-aad2292ab01c", // Office
  "27922004-5251-4030-b22d-91ecd9a37ea4", // Outlook
  "000000004FD94165",                      // Outlook Mobile
  "aebc6443-996d-45c2-90f0-388ff96faa56", // VS Code
];

const TOKEN_ENDPOINTS = [
  {
    url: "https://login.microsoftonline.com/consumers/oauth2/v2.0/token",
    scope: "https://graph.microsoft.com/.default offline_access"
  },
  {
    url: "https://login.microsoftonline.com/consumers/oauth2/v2.0/token",
    scope: "https://graph.microsoft.com/Mail.Read offline_access openid profile"
  },
  {
    url: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scope: "https://graph.microsoft.com/.default offline_access"
  },
  {
    url: "https://login.live.com/oauth20_token.srf",
    scope: "https://graph.microsoft.com/.default offline_access"
  }
];

export const onRequest: PagesFunction = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // 跨域预检处理
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      }
    });
  }

  try {
    const db = (env as any).DB as D1Database | undefined;

    // ==========================================
    // 1. 防穷举验证码路由
    // ==========================================
    if (path === "/api/auth/captcha" && request.method === "GET") {
      const code = generateRandomCode(4);
      const captchaId = await createCaptchaToken(code);
      const svg = renderCaptchaSvg(code);
      return jsonRes({ success: true, captcha_id: captchaId, svg });
    }

    // ==========================================
    // 2. 系统初始化与管理员状态查询
    // ==========================================
    if (path === "/api/auth/status" && request.method === "GET") {
      if (!db) {
        return jsonRes({ success: true, has_admin: false, db_ready: false });
      }
      const count = await getUserCount(db);
      return jsonRes({ success: true, has_admin: count > 0, db_ready: true });
    }

    // ==========================================
    // 3. 用户注册 (首位用户自动为 admin，含验证码防穷举)
    // ==========================================
    if (path === "/api/auth/register" && request.method === "POST") {
      if (!db) return errRes("D1 数据库未绑定，请配置 DB 绑定", 500);

      const body: any = await request.json().catch(() => ({}));
      const { username, password, captcha_id, captcha_code } = body;

      if (!username || typeof username !== 'string' || username.trim().length < 3) {
        return errRes("用户名至少需要 3 个字符");
      }
      if (!password || typeof password !== 'string' || password.length < 6) {
        return errRes("密码长度至少需要 6 位");
      }

      // 验证码防穷举校验
      const captchaCheck = await verifyCaptcha(captcha_id, captcha_code);
      if (!captchaCheck.valid) {
        return errRes(captchaCheck.reason || "验证码错误", 400);
      }

      const cleanUsername = username.trim().toLowerCase();
      const existing = await findUserByUsername(db, cleanUsername);
      if (existing) {
        return errRes("该用户名已被注册，请更换其他用户名");
      }

      const userCount = await getUserCount(db);
      const role = userCount === 0 ? 'admin' : 'user';
      const passwordHash = await hashPassword(password);
      const now = Date.now();
      const userId = 'usr_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);

      const newUser = {
        id: userId,
        username: cleanUsername,
        password_hash: passwordHash,
        role: role as 'admin' | 'user',
        status: 'active' as const,
        created_at: now,
        last_login_at: now,
      };

      await createUser(db, newUser);
      const token = await createJwtToken(newUser);

      return jsonRes({
        success: true,
        token,
        user: {
          id: newUser.id,
          username: newUser.username,
          role: newUser.role,
          status: newUser.status,
        },
      });
    }

    // ==========================================
    // 4. 用户登录 (含验证码防穷举)
    // ==========================================
    if (path === "/api/auth/login" && request.method === "POST") {
      if (!db) return errRes("D1 数据库未绑定，请配置 DB 绑定", 500);

      const body: any = await request.json().catch(() => ({}));
      const { username, password, captcha_id, captcha_code } = body;

      if (!username || !password) {
        return errRes("请输入用户名和密码");
      }

      // 验证码防穷举校验
      const captchaCheck = await verifyCaptcha(captcha_id, captcha_code);
      if (!captchaCheck.valid) {
        return errRes(captchaCheck.reason || "验证码错误", 400);
      }

      const cleanUsername = username.trim().toLowerCase();
      const user = await findUserByUsername(db, cleanUsername);
      if (!user) {
        return errRes("用户名或密码错误");
      }

      if (user.status === 'disabled') {
        return errRes("该账号已被管理员停用，请联系管理员", 403);
      }

      const isMatch = await verifyPassword(password, user.password_hash);
      if (!isMatch) {
        return errRes("用户名或密码错误");
      }

      const now = Date.now();
      await updateUser(db, user.id, { last_login_at: now });

      const token = await createJwtToken(user);
      return jsonRes({
        success: true,
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          status: user.status,
        },
      });
    }

    // ==========================================
    // 5. 当前登录用户详情
    // ==========================================
    if (path === "/api/auth/me" && request.method === "GET") {
      if (!db) return errRes("数据库未配置", 500);
      const currentUser = await getUserFromRequest(request);
      if (!currentUser) return errRes("未登录或登录已过期", 401);

      const user = await findUserById(db, currentUser.sub);
      if (!user) return errRes("用户不存在", 401);
      if (user.status === 'disabled') return errRes("账号已被停用", 403);

      return jsonRes({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          status: user.status,
          created_at: user.created_at,
          last_login_at: user.last_login_at,
        },
      });
    }

    // ==========================================
    // 6. 修改当前用户密码
    // ==========================================
    if (path === "/api/auth/change-password" && request.method === "POST") {
      if (!db) return errRes("数据库未配置", 500);
      const currentUser = await getUserFromRequest(request);
      if (!currentUser) return errRes("未登录", 401);

      const body: any = await request.json().catch(() => ({}));
      const { old_password, new_password } = body;

      if (!old_password || !new_password || new_password.length < 6) {
        return errRes("新密码长度必须至少为 6 位");
      }

      const user = await findUserById(db, currentUser.sub);
      if (!user) return errRes("用户不存在", 401);

      const isMatch = await verifyPassword(old_password, user.password_hash);
      if (!isMatch) {
        return errRes("原密码输入错误");
      }

      const newHash = await hashPassword(new_password);
      await updateUser(db, user.id, { password_hash: newHash });
      return jsonRes({ success: true, message: "密码修改成功" });
    }

    // ==========================================
    // 7. 管理员专属模块 (仅限 role === 'admin')
    // ==========================================
    if (path.startsWith("/api/admin/")) {
      if (!db) return errRes("数据库未配置", 500);
      const currentUser = await getUserFromRequest(request);
      if (!currentUser || currentUser.role !== 'admin') {
        return errRes("无权访问：仅超级管理员可执行该操作", 403);
      }

      // 7.1 列出所有用户
      if (path === "/api/admin/users" && request.method === "GET") {
        const users = await listAllUsers(db);
        return jsonRes({ success: true, users });
      }

      // 7.2 更新用户状态或角色
      const matchUpdate = path.match(/^\/api\/admin\/users\/([^\/]+)$/);
      if (matchUpdate && request.method === "PUT") {
        const targetUserId = matchUpdate[1];
        const body: any = await request.json().catch(() => ({}));

        if (targetUserId === currentUser.sub && (body.role === 'user' || body.status === 'disabled')) {
          return errRes("管理员不可禁用自身或撤销自己的管理员权限");
        }

        const updates: any = {};
        if (body.role === 'admin' || body.role === 'user') updates.role = body.role;
        if (body.status === 'active' || body.status === 'disabled') updates.status = body.status;

        await updateUser(db, targetUserId, updates);
        return jsonRes({ success: true });
      }

      // 7.3 重置指定用户密码
      const matchReset = path.match(/^\/api\/admin\/users\/([^\/]+)\/reset-password$/);
      if (matchReset && request.method === "POST") {
        const targetUserId = matchReset[1];
        const body: any = await request.json().catch(() => ({}));
        const { new_password } = body;
        if (!new_password || new_password.length < 6) {
          return errRes("重置密码长度至少需要 6 位");
        }
        const newHash = await hashPassword(new_password);
        await updateUser(db, targetUserId, { password_hash: newHash });
        return jsonRes({ success: true, message: "密码重置成功" });
      }

      // 7.4 删除指定用户
      if (matchUpdate && request.method === "DELETE") {
        const targetUserId = matchUpdate[1];
        if (targetUserId === currentUser.sub) {
          return errRes("管理员不可删除自身账号");
        }
        await deleteUserAndData(db, targetUserId);
        return jsonRes({ success: true });
      }
    }

    // ==========================================
    // 8. 邮箱凭据管理 (用户强隔离)
    // ==========================================
    if (path.startsWith("/api/accounts")) {
      if (!db) return errRes("数据库未配置", 500);
      const currentUser = await getUserFromRequest(request);
      if (!currentUser) return errRes("请先登录", 401);

      // 8.1 获取当前用户所有邮箱 (支持 limit/offset 分页查询，默认返回全部)
      if (path === "/api/accounts" && request.method === "GET") {
        const limitParam = url.searchParams.get("limit");
        const offsetParam = url.searchParams.get("offset");
        const options = limitParam ? {
          limit: Math.max(1, parseInt(limitParam, 10) || 100),
          offset: Math.max(0, parseInt(offsetParam || "0", 10) || 0)
        } : undefined;

        const list = await listAccountsByUser(db, currentUser.sub, options);
        return jsonRes({ success: true, accounts: list });
      }

      // 8.2 批量分批导入凭据 (支持 D1 Batch 优化)
      if (path === "/api/accounts/import" && request.method === "POST") {
        const body: any = await request.json().catch(() => ({}));
        const accountsToImport: Array<{ email: string; password?: string; refresh_token: string; client_id?: string; tags?: string[] }> = body.accounts || [];

        const now = Date.now();
        const records: DbAccount[] = [];

        for (const item of accountsToImport) {
          if (!item.email || !item.refresh_token) continue;
          const cleanEmail = item.email.trim().toLowerCase();
          const accountId = `${currentUser.sub}_${cleanEmail}`;

          records.push({
            id: accountId,
            user_id: currentUser.sub,
            email: cleanEmail,
            password: item.password || undefined,
            refresh_token: item.refresh_token.trim(),
            client_id: item.client_id || DEFAULT_CLIENT_ID,
            status: 'idle',
            tags: JSON.stringify(item.tags || []),
            created_at: now,
          });
        }

        const savedCount = await saveAccountsBatch(db, records);
        return jsonRes({ success: true, count: savedCount });
      }

      // 8.2.1 修改指定账号的注释标签
      const matchTags = path.match(/^\/api\/accounts\/([^\/]+)\/tags$/);
      if (matchTags && (request.method === "PUT" || request.method === "PATCH")) {
        const accountId = matchTags[1];
        const body: any = await request.json().catch(() => ({}));
        const rawTags = Array.isArray(body.tags) ? body.tags : [];
        const cleanTags = Array.from(new Set(rawTags.map((t: any) => String(t).trim()).filter(Boolean)));
        await updateAccountTags(db, currentUser.sub, accountId, cleanTags);
        return jsonRes({ success: true, tags: cleanTags });
      }

      // 8.3 同步单个账号 (刷新凭证 + 拉取邮件 + 自动更新滚动 RT)
      const matchSync = path.match(/^\/api\/accounts\/([^\/]+)\/sync$/);
      if (matchSync && request.method === "POST") {
        const accountId = matchSync[1];
        const account = await getAccountById(db, currentUser.sub, accountId);
        if (!account) return errRes("未找到该邮箱账号", 404);

        const now = Date.now();
        // 尝试刷新与拉取
        const mailListRes = await doSyncAccountMail(account);

        // 如果微软返回了新 RT，或者状态改变，写回数据库
        await updateAccountSyncResult(db, account.id, {
          refresh_token: mailListRes.new_refresh_token,
          client_id: mailListRes.client_id,
          status: mailListRes.status,
          dead_reason: mailListRes.dead_reason,
          rate_limit_until: mailListRes.rate_limit_until,
          last_checked_at: now,
          unread_count: mailListRes.unread_count,
          latest_code: mailListRes.latest_code,
          latest_code_time: mailListRes.latest_code_time,
        });

        // 保存新邮件
        if (mailListRes.emails && mailListRes.emails.length > 0) {
          const emailsToSave: DbEmail[] = mailListRes.emails.map(m => ({
            id: m.id,
            user_id: currentUser.sub,
            account_email: account.email.toLowerCase(),
            subject: m.subject || '(无主题)',
            sender_name: m.from?.emailAddress?.name || '',
            sender_address: m.from?.emailAddress?.address || '',
            received_at: m.receivedDateTime || new Date().toISOString(),
            body_preview: m.bodyPreview || '',
            body_html: m.body?.content || '',
            extracted_code: extractVerificationCode(m.subject, m.bodyPreview, m.body?.content),
            is_junk: m.__is_junk ? 1 : 0,
            is_read: 0,
            raw_headers: m.internetMessageHeaders ? JSON.stringify(m.internetMessageHeaders) : undefined,
          }));

          await saveEmails(db, emailsToSave);
        }

        const updatedAccount = await getAccountById(db, currentUser.sub, accountId);
        return jsonRes({
          success: true,
          account: updatedAccount,
          messages_count: mailListRes.emails?.length || 0,
          new_refresh_token: mailListRes.new_refresh_token,
        });
      }

      // 8.4 删除单账号
      const matchDelete = path.match(/^\/api\/accounts\/([^\/]+)$/);
      if (matchDelete && request.method === "DELETE") {
        const accountId = matchDelete[1];
        await deleteAccount(db, currentUser.sub, accountId);
        return jsonRes({ success: true });
      }

      // 8.5 清理死号
      if (path === "/api/accounts/purge-dead" && request.method === "POST") {
        const count = await purgeDeadAccounts(db, currentUser.sub);
        return jsonRes({ success: true, count });
      }
    }

    // ==========================================
    // 9. 邮件列表与已读管理 (用户强隔离)
    // ==========================================
    if (path.startsWith("/api/emails")) {
      if (!db) return errRes("数据库未配置", 500);
      const currentUser = await getUserFromRequest(request);
      if (!currentUser) return errRes("请先登录", 401);

      // 9.1 查询邮件
      if (path === "/api/emails" && request.method === "GET") {
        const accountEmail = url.searchParams.get("account_email") || undefined;
        const isJunkParam = url.searchParams.get("is_junk");
        const hasCodeParam = url.searchParams.get("has_code");
        const unreadOnlyParam = url.searchParams.get("unread_only");
        const search = url.searchParams.get("search") || undefined;
        const limitParam = parseInt(url.searchParams.get("limit") || "200", 10);
        const offsetParam = parseInt(url.searchParams.get("offset") || "0", 10);

        const limit = Math.min(Math.max(1, isNaN(limitParam) ? 200 : limitParam), 1000);
        const offset = Math.max(0, isNaN(offsetParam) ? 0 : offsetParam);

        const emails = await listEmailsByUser(db, currentUser.sub, {
          accountEmail,
          isJunk: isJunkParam !== null ? isJunkParam === 'true' : undefined,
          hasCode: hasCodeParam === 'true',
          unreadOnly: unreadOnlyParam === 'true',
          search,
          limit,
          offset,
        });

        return jsonRes({ success: true, emails });
      }

      // 9.2 标记已读
      const matchRead = path.match(/^\/api\/emails\/([^\/]+)\/read$/);
      if (matchRead && request.method === "POST") {
        const emailId = matchRead[1];
        const body: any = await request.json().catch(() => ({}));
        await updateEmailReadStatus(db, currentUser.sub, emailId, Boolean(body.is_read));
        return jsonRes({ success: true });
      }

      // 9.3 删除单封邮件
      const matchEmailDel = path.match(/^\/api\/emails\/([^\/]+)$/);
      if (matchEmailDel && request.method === "DELETE") {
        const emailId = matchEmailDel[1];
        await deleteEmail(db, currentUser.sub, emailId);
        return jsonRes({ success: true });
      }
    }

    // ==========================================
    // 10. 原生/向下兼容无状态路由: /api/token/refresh
    // ==========================================
    if (path === "/api/token/refresh" && request.method === "POST") {
      const body = (await request.json()) as RefreshTokenRequest;
      if (!body.refresh_token) {
        return jsonRes({ success: false, error: "Missing refresh_token" }, 400);
      }
      const res = await doRefreshToken(body.refresh_token, body.client_id);
      return jsonRes(res, res.success ? 200 : 400);
    }

    // ==========================================
    // 11. 原生/向下兼容无状态路由: /api/mail/list
    // ==========================================
    if (path === "/api/mail/list" && request.method === "POST") {
      const body = (await request.json()) as MailListRequest;
      let accessToken = body.access_token;
      let newRefreshToken: string | undefined = undefined;
      let usedClientId = body.client_id;

      if (!accessToken && body.refresh_token) {
        const tokenRes = await doRefreshToken(body.refresh_token, body.client_id);
        if (!tokenRes.success) {
          return jsonRes(tokenRes, 400);
        }
        accessToken = tokenRes.access_token;
        newRefreshToken = tokenRes.new_refresh_token;
        usedClientId = tokenRes.client_id;
      }

      if (!accessToken) {
        return jsonRes({ success: false, error: "Missing access_token" }, 400);
      }

      const { messages, error, status, retryAfter } = await fetchMailMessages(accessToken, body.top || 25, body.include_junk !== false);
      if (error) {
        return jsonRes({ success: false, error, retry_after: retryAfter, new_refresh_token: newRefreshToken }, status || 500);
      }

      const responsePayload: MailListResponse = {
        success: true,
        messages,
        new_refresh_token: newRefreshToken,
        client_id: usedClientId,
      };

      return jsonRes(responsePayload);
    }

    return jsonRes({ error: "Endpoint not found" }, 404);
  } catch (err: any) {
    return jsonRes({ success: false, error: err.message || String(err) }, 500);
  }
};

function jsonRes(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function errRes(message: string, status = 400) {
  return jsonRes({ success: false, error: message }, status);
}

// 辅助方法：同步单个账号并提取验证码
async function doSyncAccountMail(account: DbAccount) {
  const tokenRes = await doRefreshToken(account.refresh_token, account.client_id);

  if (!tokenRes.success) {
    return {
      status: tokenRes.is_dead ? 'dead' : 'idle',
      dead_reason: tokenRes.error,
      new_refresh_token: undefined,
      client_id: account.client_id,
      emails: [],
    };
  }

  const accessToken = tokenRes.access_token!;
  const newRefreshToken = tokenRes.new_refresh_token || account.refresh_token;
  const usedClientId = tokenRes.client_id || account.client_id;

  const mailRes = await fetchMailMessages(accessToken, 25, true);

  if (mailRes.error) {
    if (mailRes.status === 429) {
      return {
        status: 'rate_limited',
        rate_limit_until: Date.now() + (mailRes.retryAfter || 30) * 1000,
        new_refresh_token: newRefreshToken,
        client_id: usedClientId,
        emails: [],
      };
    }
    return {
      status: 'idle',
      dead_reason: mailRes.error,
      new_refresh_token: newRefreshToken,
      client_id: usedClientId,
      emails: [],
    };
  }

  const messages = mailRes.messages || [];
  let latestCode: string | undefined = account.latest_code;
  let latestCodeTime: string | undefined = account.latest_code_time;

  for (const m of messages) {
    const code = extractVerificationCode(m.subject, m.bodyPreview, m.body?.content);
    const dateStr = m.receivedDateTime || new Date().toISOString();
    if (code) {
      if (!latestCodeTime || new Date(dateStr).getTime() >= new Date(latestCodeTime).getTime()) {
        latestCode = code;
        latestCodeTime = dateStr;
      }
    }
  }

  return {
    status: messages.length === 0 ? 'empty' : 'active',
    new_refresh_token: newRefreshToken,
    client_id: usedClientId,
    unread_count: messages.length,
    latest_code: latestCode,
    latest_code_time: latestCodeTime,
    emails: messages,
  };
}

// 刷新 Token 逻辑：多端点回退与死号判断
export async function doRefreshToken(refreshToken: string, preferredClientId?: string): Promise<RefreshTokenResponse> {
  const clientIds = [
    preferredClientId,
    ...FALLBACK_CLIENT_IDS.filter(id => id !== preferredClientId)
  ].filter(Boolean) as string[];

  let lastError = null;

  for (const clientId of clientIds) {
    for (const ep of TOKEN_ENDPOINTS) {
      const form = new URLSearchParams();
      form.set("client_id", clientId);
      form.set("refresh_token", refreshToken);
      form.set("grant_type", "refresh_token");
      if (ep.scope) form.set("scope", ep.scope);

      try {
        const resp = await fetch(ep.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
          },
          body: form.toString(),
        });

        const data: any = await resp.json().catch(() => ({}));

        if (resp.ok && data.access_token) {
          return {
            success: true,
            access_token: data.access_token,
            expires_in: data.expires_in || 3600,
            new_refresh_token: data.refresh_token || refreshToken,
            client_id: clientId,
          };
        }

        const errDesc = String(data.error_description || data.error || `HTTP ${resp.status}`);
        lastError = errDesc;

        // 死号快速判定
        if (/AADSTS50173|AADSTS700082|AADSTS700084|AADSTS700016|invalid_grant|interaction_required/i.test(errDesc)) {
          return {
            success: false,
            error: errDesc,
            is_dead: true,
          };
        }
      } catch (e: any) {
        lastError = e?.message || String(e);
      }
    }
  }

  return { success: false, error: lastError || "Refresh token failed", is_dead: false };
}

// 并发拉取收件箱与垃圾箱
export async function fetchMailMessages(accessToken: string, top = 25, includeJunk = true) {
  const headers = {
    "Authorization": `Bearer ${accessToken}`,
    "Accept": "application/json",
  };

  const selectFields = "id,subject,receivedDateTime,from,bodyPreview,body,toRecipients,ccRecipients,internetMessageHeaders";
  const query = `$top=${Math.min(50, Math.max(5, top))}&$orderby=receivedDateTime desc&$select=${selectFields}`;

  const inboxUrl = `https://graph.microsoft.com/v1.0/me/messages?${query}`;
  const junkUrl = `https://graph.microsoft.com/v1.0/me/mailFolders/junkemail/messages?${query}`;

  const tasks: Promise<any>[] = [
    fetch(inboxUrl, { headers }).then(async r => {
      const retryAfter = r.headers.get("Retry-After");
      return { status: r.status, ok: r.ok, retryAfter, data: await r.json().catch(() => ({})) };
    })
  ];

  if (includeJunk) {
    tasks.push(
      fetch(junkUrl, { headers }).then(async r => {
        const retryAfter = r.headers.get("Retry-After");
        return { status: r.status, ok: r.ok, retryAfter, data: await r.json().catch(() => ({})) };
      })
    );
  }

  const [inboxRes, junkRes] = await Promise.all(tasks);

  // 429 限流检测
  if (inboxRes.status === 429 || (junkRes && junkRes.status === 429)) {
    const retrySec = Number(inboxRes.retryAfter || junkRes?.retryAfter || 30);
    return { messages: [], error: "Rate limited by Microsoft Graph (429)", status: 429, retryAfter: retrySec };
  }

  if (!inboxRes.ok && inboxRes.status >= 400 && inboxRes.status !== 404) {
    return { messages: [], error: `Graph inbox HTTP ${inboxRes.status}`, status: inboxRes.status };
  }

  const rawList: GraphMessageItem[] = [...(inboxRes.data?.value || [])];
  if (junkRes?.data?.value) {
    for (const item of junkRes.data.value) {
      item.__is_junk = true;
      rawList.push(item);
    }
  }

  // 严格按 ID 去重
  const seen = new Set<string>();
  const deduped: GraphMessageItem[] = [];
  for (const m of rawList) {
    if (!m.id || !seen.has(m.id)) {
      if (m.id) seen.add(m.id);
      deduped.push(m);
    }
  }

  // 倒序排列
  deduped.sort((a, b) => new Date(b.receivedDateTime || 0).getTime() - new Date(a.receivedDateTime || 0).getTime());
  return { messages: deduped };
}
