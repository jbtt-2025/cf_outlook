/**
 * Cloudflare Pages Function: 全栈后端边缘网关
 * 路由：/api/* (同源免 CORS，纯无状态代理)
 */

import type {
  RefreshTokenRequest,
  RefreshTokenResponse,
  MailListRequest,
  MailListResponse,
  GraphMessageItem
} from '../../src/types/api';

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
  const { request } = context;
  const url = new URL(request.url);

  // 跨域预检处理（同源相对路径调用时直接快速响应）
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      }
    });
  }

  try {
    // 路由 1: POST /api/token/refresh - 刷新 Token
    if (url.pathname === "/api/token/refresh" && request.method === "POST") {
      const body = (await request.json()) as RefreshTokenRequest;
      if (!body.refresh_token) {
        return jsonRes({ success: false, error: "Missing refresh_token" }, 400);
      }
      const res = await doRefreshToken(body.refresh_token, body.client_id);
      return jsonRes(res, res.success ? 200 : 400);
    }

    // 路由 2: POST /api/mail/list - 邮件双箱拉取
    if (url.pathname === "/api/mail/list" && request.method === "POST") {
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
