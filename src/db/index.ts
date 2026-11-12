import Dexie, { type Table } from 'dexie';

export type AccountStatus = 'idle' | 'refreshing' | 'fetching' | 'active' | 'empty' | 'dead' | 'rate_limited';

export interface OutlookAccount {
  id: string;               // 邮箱小写唯一键
  email: string;            // 邮箱账号
  password?: string;        // 密码
  refresh_token: string;    // 当前最新 RT (滚动时自动写回)
  client_id?: string;       // 绑定的 client_id
  status: AccountStatus;    // 状态机状态
  dead_reason?: string;     // 报错原因 (如 AADSTS700082)
  rate_limit_until?: number;// 429 冷却截止时间戳
  last_checked_at?: number; // 上次检测时间戳
  unread_count?: number;    // 未读邮件总数
  latest_code?: string;     // 最新提取出的验证码
  latest_code_time?: string;// 最新验证码到达时间
  tags: string[];           // 分类标签
  created_at: number;
}

export interface StoredEmail {
  id: string;               // 邮件全局 ID
  account_email: string;    // 所属邮箱
  subject: string;          // 邮件标题
  sender_name: string;      // 发件人名称
  sender_address: string;   // 发件人邮箱
  received_at: string;      // 接收时间 ISO
  body_preview: string;     // 文本预览
  body_html?: string;       // 完整 HTML 正文
  extracted_code?: string;  // 提取出的验证码
  is_junk: boolean;         // 是否位于垃圾箱
  is_read: boolean;         // 本地已读状态
  raw_headers?: Array<{ name: string; value: string }>;
}

export class WebmailDB extends Dexie {
  accounts!: Table<OutlookAccount, string>;
  emails!: Table<StoredEmail, string>;

  constructor() {
    super('OutlookPagesBatchDB');
    this.version(1).stores({
      accounts: 'id, email, status, last_checked_at, *tags',
      emails: 'id, account_email, received_at, extracted_code, is_read, is_junk',
    });
    this.version(2).stores({
      accounts: 'id, email, status, last_checked_at, created_at, *tags',
      emails: 'id, account_email, received_at, extracted_code, is_read, is_junk',
    });
  }
}

export const db = new WebmailDB();
