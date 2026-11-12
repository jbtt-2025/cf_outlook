import { db, type OutlookAccount, type StoredEmail } from '../db';
import type { MailListRequest, MailListResponse } from '../types/api';
import { extractVerificationCode } from './codeParser';
import { getStoredToken, api } from './apiClient';

export interface SchedulerOptions {
  concurrency?: number;
  autoPoll?: boolean;
}

class Scheduler {
  private concurrency: number = 5;
  private pollIntervalSec: number = 180; // 默认 180 秒拉取周期
  private isRunning: boolean = false;
  private activeJobs: number = 0;
  private queue: string[] = []; // 待拉取账号 ID 队列
  private timer: any = null;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.concurrency = 5;
    this.pollIntervalSec = 180;
  }

  public setConcurrency(limit: number) {
    this.concurrency = Math.max(1, Math.min(15, limit));
  }

  public getConcurrency() {
    return this.concurrency;
  }

  public setPollInterval(seconds: number) {
    this.pollIntervalSec = Math.max(5, Math.min(3600, seconds));
  }

  public getPollInterval(): number {
    return this.pollIntervalSec;
  }

  public subscribe(cb: () => void) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify() {
    this.listeners.forEach(cb => {
      try {
        cb();
      } catch (e) {
        console.error(e);
      }
    });
  }

  public startAutoPolling(intervalSec?: number) {
    if (intervalSec) {
      this.setPollInterval(intervalSec);
    }
    if (this.timer) clearInterval(this.timer);
    this.isRunning = true;
    this.checkPendingAccounts();

    // 调度心跳每 5 秒触发一次检查，以便高优先级及到达周期的账号即时入队
    this.timer = setInterval(() => {
      if (this.isRunning) {
        this.checkPendingAccounts();
      }
    }, 5000);
    this.notify();
  }

  public stopAutoPolling() {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.notify();
  }

  public isAutoPolling(): boolean {
    return this.isRunning;
  }

  public getRunningCount(): number {
    return this.activeJobs;
  }

  // 手动触发全部体检
  public async checkAll() {
    const allAccounts = await db.accounts.toArray();
    for (const acc of allAccounts) {
      if (acc.status !== 'dead') {
        this.enqueue(acc.id);
      }
    }
    this.processQueue();
  }

  // 手动检测单账号
  public async checkAccount(id: string) {
    const acc = await db.accounts.get(id);
    if (!acc) return;
    this.enqueue(id, true);
    this.processQueue();
  }

  public enqueue(accountId: string, highPriority = false) {
    if (this.queue.includes(accountId)) return;
    if (highPriority) {
      this.queue.unshift(accountId);
    } else {
      this.queue.push(accountId);
    }
  }

  private async checkPendingAccounts() {
    const now = Date.now();
    const accounts = await db.accounts.toArray();

    for (const acc of accounts) {
      // 忽略已确认死号
      if (acc.status === 'dead') continue;

      // 429 限流冷却中
      if (acc.status === 'rate_limited') {
        if (acc.rate_limit_until && now < acc.rate_limit_until) {
          continue;
        } else {
          // 冷却结束，转为 idle
          await db.accounts.update(acc.id, { status: 'idle', rate_limit_until: undefined });
        }
      }

      // 根据状态动态判断是否需要拉取 (基础周期默认 180 秒，可自定义)
      const lastCheck = acc.last_checked_at || 0;
      const baseInterval = this.pollIntervalSec * 1000;
      let interval = baseInterval;

      if (acc.status === 'empty') {
        interval = Math.max(baseInterval, 300000); // 空箱降频至至少 300 秒或用户设定的更长周期
      } else if (acc.latest_code_time) {
        const codeAge = now - new Date(acc.latest_code_time).getTime();
        if (codeAge < 300000) {
          interval = Math.min(15000, baseInterval); // 近期 5 分钟内有验证码的高频监听 (15秒)
        }
      }

      if (now - lastCheck >= interval) {
        this.enqueue(acc.id);
      }
    }

    this.processQueue();
  }

  private async processQueue() {
    while (this.activeJobs < this.concurrency && this.queue.length > 0) {
      const nextId = this.queue.shift();
      if (!nextId) break;

      const account = await db.accounts.get(nextId);
      if (!account || account.status === 'dead') continue;

      this.activeJobs++;
      this.notify();

      this.runAccountJob(account).finally(() => {
        this.activeJobs--;
        this.notify();
        this.processQueue();
      });
    }
  }

  private async runAccountJob(account: OutlookAccount) {
    const now = Date.now();

    try {
      // 1. 设置状态为 fetching
      await db.accounts.update(account.id, {
        status: 'fetching',
      });
      this.notify();

      const token = getStoredToken();

      // 如果已登录，优先调用服务端的同步接口，服务端自动更新数据库并回写最新 RT
      if (token) {
        try {
          const syncRes = await api.post(`/api/accounts/${account.id}/sync`);
          if (syncRes.success && syncRes.account) {
            const acc = syncRes.account;
            await db.accounts.update(account.id, {
              refresh_token: acc.refresh_token,
              client_id: acc.client_id,
              status: acc.status,
              dead_reason: acc.dead_reason,
              rate_limit_until: acc.rate_limit_until,
              last_checked_at: acc.last_checked_at,
              unread_count: acc.unread_count,
              latest_code: acc.latest_code,
              latest_code_time: acc.latest_code_time,
            });

            // 重新拉取邮件列表更新本地
            const emailRes = await api.get(`/api/emails?account_email=${encodeURIComponent(account.email)}`);
            if (emailRes.success && emailRes.emails) {
              for (const m of emailRes.emails) {
                await db.emails.put({
                  id: m.id,
                  account_email: m.account_email,
                  subject: m.subject,
                  sender_name: m.sender_name,
                  sender_address: m.sender_address,
                  received_at: m.received_at,
                  body_preview: m.body_preview,
                  body_html: m.body_html,
                  extracted_code: m.extracted_code,
                  is_junk: Boolean(m.is_junk),
                  is_read: Boolean(m.is_read),
                  raw_headers: m.raw_headers ? JSON.parse(m.raw_headers) : undefined,
                });
              }
            }
            return;
          }
        } catch (serverErr: any) {
          console.warn('[Sync API Server Error, fallback to direct]', serverErr);
        }
      }

      // 未登录或服务端备用降级：发起 POST /api/mail/list 请求
      const payload: MailListRequest = {
        refresh_token: account.refresh_token,
        client_id: account.client_id,
        top: 25,
        include_junk: true,
      };

      const resp = await fetch('/api/mail/list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = (await resp.json().catch(() => ({}))) as (MailListResponse & { retry_after?: number; is_dead?: boolean });

      // 处理 429 限流
      if (resp.status === 429 || data.error?.includes('429')) {
        const retrySec = data.retry_after || 30;
        await db.accounts.update(account.id, {
          status: 'rate_limited',
          rate_limit_until: now + retrySec * 1000,
          last_checked_at: now,
        });
        return;
      }

      // 处理失败（死号或网络/凭证错误）
      if (!resp.ok || !data.success) {
        const isDead = data.is_dead || /AADSTS50173|AADSTS700082|AADSTS700084|AADSTS700016|invalid_grant|interaction_required/i.test(data.error || '');
        await db.accounts.update(account.id, {
          status: isDead ? 'dead' : 'idle',
          dead_reason: isDead ? (data.error || 'Token expired / revoked') : undefined,
          last_checked_at: now,
        });
        return;
      }

      // 3. 处理成功：如果有新 RT，自动原子覆盖回写
      const updates: Partial<OutlookAccount> = {
        last_checked_at: now,
        dead_reason: undefined,
      };

      if (data.new_refresh_token && data.new_refresh_token !== account.refresh_token) {
        updates.refresh_token = data.new_refresh_token;
      }
      if (data.client_id) {
        updates.client_id = data.client_id;
      }

      const messages = data.messages || [];
      if (messages.length === 0) {
        updates.status = 'empty';
      } else {
        updates.status = 'active';
      }

      // 4. 解析并保存邮件入库
      let latestFoundCode: string | undefined = account.latest_code;
      let latestCodeTime: string | undefined = account.latest_code_time;

      const emailsToSave: StoredEmail[] = [];

      for (const m of messages) {
        const subject = m.subject || '(无主题)';
        const preview = m.bodyPreview || '';
        const html = m.body?.content || '';
        const code = extractVerificationCode(subject, preview, html);

        const emailDate = m.receivedDateTime || new Date().toISOString();
        if (code) {
          if (!latestCodeTime || new Date(emailDate).getTime() >= new Date(latestCodeTime).getTime()) {
            latestFoundCode = code;
            latestCodeTime = emailDate;
          }
        }

        emailsToSave.push({
          id: m.id,
          account_email: account.email.toLowerCase(),
          subject,
          sender_name: m.from?.emailAddress?.name || '',
          sender_address: m.from?.emailAddress?.address || '',
          received_at: emailDate,
          body_preview: preview,
          body_html: html,
          extracted_code: code,
          is_junk: Boolean(m.__is_junk),
          is_read: false,
          raw_headers: m.internetMessageHeaders,
        });
      }

      if (latestFoundCode) {
        updates.latest_code = latestFoundCode;
        updates.latest_code_time = latestCodeTime;
      }

      // 批量存储邮件，保留本地已有 is_read 状态
      for (const mail of emailsToSave) {
        const existing = await db.emails.get(mail.id);
        if (existing) {
          mail.is_read = existing.is_read;
        }
        await db.emails.put(mail);
      }

      const totalUnread = await db.emails.where('account_email').equals(account.email.toLowerCase()).and(e => !e.is_read).count();
      updates.unread_count = totalUnread;

      await db.accounts.update(account.id, updates);
    } catch (err: any) {
      console.error(`Error syncing account ${account.email}:`, err);
      await db.accounts.update(account.id, {
        status: 'idle',
        last_checked_at: now,
      });
    } finally {
      this.notify();
    }
  }
}

export const scheduler = new Scheduler();
