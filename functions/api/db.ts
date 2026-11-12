/**
 * Cloudflare D1 数据库统一数据访问层与迁移服务
 */

export interface DbUser {
  id: string;
  username: string;
  password_hash: string;
  role: 'admin' | 'user';
  status: 'active' | 'disabled';
  created_at: number;
  last_login_at?: number;
}

export interface DbAccount {
  id: string;               // user_id + '_' + email
  user_id: string;
  email: string;
  password?: string;
  refresh_token: string;
  client_id?: string;
  status: string;           // 'idle' | 'fetching' | 'active' | 'empty' | 'dead' | 'rate_limited'
  dead_reason?: string;
  rate_limit_until?: number;
  last_checked_at?: number;
  unread_count?: number;
  latest_code?: string;
  latest_code_time?: string;
  tags?: string;            // JSON string array
  created_at: number;
}

export interface DbEmail {
  id: string;
  user_id: string;
  account_email: string;
  subject: string;
  sender_name: string;
  sender_address: string;
  received_at: string;
  body_preview: string;
  body_html?: string;
  extracted_code?: string;
  is_junk: number;
  is_read: number;
  raw_headers?: string;
}

let dbInitialized = false;

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    status TEXT NOT NULL DEFAULT 'active',
    created_at INTEGER NOT NULL,
    last_login_at INTEGER
  )`,
  `CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`,
  `CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    email TEXT NOT NULL,
    password TEXT,
    refresh_token TEXT NOT NULL,
    client_id TEXT,
    status TEXT NOT NULL DEFAULT 'idle',
    dead_reason TEXT,
    rate_limit_until INTEGER,
    last_checked_at INTEGER,
    unread_count INTEGER DEFAULT 0,
    latest_code TEXT,
    latest_code_time TEXT,
    tags TEXT DEFAULT '[]',
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_accounts_email ON accounts(email)`,
  `CREATE INDEX IF NOT EXISTS idx_accounts_user_created ON accounts(user_id, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS emails (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    account_email TEXT NOT NULL,
    subject TEXT,
    sender_name TEXT,
    sender_address TEXT,
    received_at TEXT,
    body_preview TEXT,
    body_html TEXT,
    extracted_code TEXT,
    is_junk INTEGER DEFAULT 0,
    is_read INTEGER DEFAULT 0,
    raw_headers TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_emails_user_account ON emails(user_id, account_email)`,
  `CREATE INDEX IF NOT EXISTS idx_emails_received ON emails(received_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_emails_user_received ON emails(user_id, received_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_emails_user_account_received ON emails(user_id, account_email, received_at DESC)`
];

function cleanSql(sql: string): string {
  return sql.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// 1. 初始化数据库表结构与索引
export async function initDatabase(db: D1Database): Promise<void> {
  if (dbInitialized) return;

  for (const rawSql of SCHEMA_STATEMENTS) {
    // 将 SQL 压缩为单行格式，避免 Cloudflare D1 边缘端将多行换行截断导致 SQLITE_ERROR: incomplete input
    await db.prepare(cleanSql(rawSql)).run();
  }

  dbInitialized = true;
}

// 2. 用户操作
export async function getUserCount(db: D1Database): Promise<number> {
  await initDatabase(db);
  const row = await db.prepare('SELECT COUNT(*) as cnt FROM users').first<{ cnt: number }>();
  return row?.cnt || 0;
}

export async function findUserByUsername(db: D1Database, username: string): Promise<DbUser | null> {
  await initDatabase(db);
  return db.prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?)').bind(username).first<DbUser>();
}

export async function findUserById(db: D1Database, id: string): Promise<DbUser | null> {
  await initDatabase(db);
  return db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<DbUser>();
}

export async function createUser(db: D1Database, user: DbUser): Promise<void> {
  await initDatabase(db);
  await db.prepare(cleanSql(`
    INSERT INTO users (id, username, password_hash, role, status, created_at, last_login_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)).bind(
    user.id,
    user.username,
    user.password_hash,
    user.role,
    user.status,
    user.created_at,
    user.last_login_at || null
  ).run();
}

export async function listAllUsers(db: D1Database): Promise<Array<Omit<DbUser, 'password_hash'> & { account_count: number }>> {
  await initDatabase(db);
  const res = await db.prepare(cleanSql(`
    SELECT u.id, u.username, u.role, u.status, u.created_at, u.last_login_at,
           COUNT(a.id) as account_count
    FROM users u
    LEFT JOIN accounts a ON u.id = a.user_id
    GROUP BY u.id
    ORDER BY u.created_at ASC
  `)).all<any>();
  return res.results || [];
}

export async function updateUser(db: D1Database, id: string, updates: Partial<DbUser>): Promise<void> {
  await initDatabase(db);
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.role !== undefined) {
    fields.push('role = ?');
    values.push(updates.role);
  }
  if (updates.status !== undefined) {
    fields.push('status = ?');
    values.push(updates.status);
  }
  if (updates.password_hash !== undefined) {
    fields.push('password_hash = ?');
    values.push(updates.password_hash);
  }
  if (updates.last_login_at !== undefined) {
    fields.push('last_login_at = ?');
    values.push(updates.last_login_at);
  }

  if (fields.length === 0) return;

  values.push(id);
  const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
  await db.prepare(sql).bind(...values).run();
}

export async function deleteUserAndData(db: D1Database, id: string): Promise<void> {
  await initDatabase(db);
  // 删除邮件与账号
  await db.prepare('DELETE FROM emails WHERE user_id = ?').bind(id).run();
  await db.prepare('DELETE FROM accounts WHERE user_id = ?').bind(id).run();
  await db.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
}

// 3. 账号凭据操作 (用户隔离)
export async function listAccountsByUser(
  db: D1Database,
  userId: string,
  options?: { limit?: number; offset?: number }
): Promise<DbAccount[]> {
  await initDatabase(db);
  if (options?.limit !== undefined) {
    const limit = Math.max(1, options.limit);
    const offset = Math.max(0, options.offset || 0);
    const res = await db.prepare('SELECT * FROM accounts WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .bind(userId, limit, offset)
      .all<DbAccount>();
    return res.results || [];
  }

  const res = await db.prepare('SELECT * FROM accounts WHERE user_id = ? ORDER BY created_at DESC')
    .bind(userId)
    .all<DbAccount>();
  return res.results || [];
}

export async function getAccountById(db: D1Database, userId: string, accountId: string): Promise<DbAccount | null> {
  await initDatabase(db);
  return db.prepare('SELECT * FROM accounts WHERE id = ? AND user_id = ?')
    .bind(accountId, userId)
    .first<DbAccount>();
}

export async function saveAccount(db: D1Database, account: DbAccount): Promise<void> {
  await initDatabase(db);
  await db.prepare(cleanSql(`
    INSERT INTO accounts (
      id, user_id, email, password, refresh_token, client_id,
      status, dead_reason, rate_limit_until, last_checked_at,
      unread_count, latest_code, latest_code_time, tags, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      refresh_token = excluded.refresh_token,
      password = COALESCE(excluded.password, accounts.password),
      client_id = COALESCE(excluded.client_id, accounts.client_id),
      status = excluded.status,
      dead_reason = excluded.dead_reason,
      rate_limit_until = excluded.rate_limit_until,
      last_checked_at = excluded.last_checked_at,
      unread_count = excluded.unread_count,
      latest_code = COALESCE(excluded.latest_code, accounts.latest_code),
      latest_code_time = COALESCE(excluded.latest_code_time, accounts.latest_code_time),
      tags = excluded.tags
  `)).bind(
    account.id,
    account.user_id,
    account.email,
    account.password || null,
    account.refresh_token,
    account.client_id || null,
    account.status,
    account.dead_reason || null,
    account.rate_limit_until || null,
    account.last_checked_at || null,
    account.unread_count || 0,
    account.latest_code || null,
    account.latest_code_time || null,
    account.tags || '[]',
    account.created_at
  ).run();
}

/**
 * 批量分批导入账号 (D1 batch 优化，单批 50 条，避免 Worker 超时与 CPU 溢出)
 */
export async function saveAccountsBatch(db: D1Database, accounts: DbAccount[]): Promise<number> {
  if (accounts.length === 0) return 0;
  await initDatabase(db);

  const INSERT_SQL = cleanSql(`
    INSERT INTO accounts (
      id, user_id, email, password, refresh_token, client_id,
      status, dead_reason, rate_limit_until, last_checked_at,
      unread_count, latest_code, latest_code_time, tags, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      refresh_token = excluded.refresh_token,
      password = COALESCE(excluded.password, accounts.password),
      client_id = COALESCE(excluded.client_id, accounts.client_id),
      status = excluded.status,
      dead_reason = excluded.dead_reason,
      rate_limit_until = excluded.rate_limit_until,
      last_checked_at = excluded.last_checked_at,
      unread_count = excluded.unread_count,
      latest_code = COALESCE(excluded.latest_code, accounts.latest_code),
      latest_code_time = COALESCE(excluded.latest_code_time, accounts.latest_code_time),
      tags = excluded.tags
  `);

  const CHUNK_SIZE = 50;
  let savedCount = 0;

  for (let i = 0; i < accounts.length; i += CHUNK_SIZE) {
    const chunk = accounts.slice(i, i + CHUNK_SIZE);
    const statements = chunk.map(account =>
      db.prepare(INSERT_SQL).bind(
        account.id,
        account.user_id,
        account.email,
        account.password || null,
        account.refresh_token,
        account.client_id || null,
        account.status,
        account.dead_reason || null,
        account.rate_limit_until || null,
        account.last_checked_at || null,
        account.unread_count || 0,
        account.latest_code || null,
        account.latest_code_time || null,
        account.tags || '[]',
        account.created_at
      )
    );
    await db.batch(statements);
    savedCount += chunk.length;
  }

  return savedCount;
}

/**
 * 更新账号标签注释
 */
export async function updateAccountTags(
  db: D1Database,
  userId: string,
  accountId: string,
  tags: string[]
): Promise<void> {
  await initDatabase(db);
  await db.prepare(cleanSql('UPDATE accounts SET tags = ? WHERE id = ? AND user_id = ?'))
    .bind(JSON.stringify(tags), accountId, userId)
    .run();
}

export async function updateAccountSyncResult(
  db: D1Database,
  accountId: string,
  updates: {
    refresh_token?: string;
    client_id?: string;
    status: string;
    dead_reason?: string;
    rate_limit_until?: number;
    last_checked_at: number;
    unread_count?: number;
    latest_code?: string;
    latest_code_time?: string;
  }
): Promise<void> {
  await initDatabase(db);
  const fields = [
    'status = ?',
    'dead_reason = ?',
    'rate_limit_until = ?',
    'last_checked_at = ?'
  ];
  const values: any[] = [
    updates.status,
    updates.dead_reason || null,
    updates.rate_limit_until || null,
    updates.last_checked_at
  ];

  if (updates.refresh_token) {
    fields.push('refresh_token = ?');
    values.push(updates.refresh_token);
  }
  if (updates.client_id) {
    fields.push('client_id = ?');
    values.push(updates.client_id);
  }
  if (updates.unread_count !== undefined) {
    fields.push('unread_count = ?');
    values.push(updates.unread_count);
  }
  if (updates.latest_code) {
    fields.push('latest_code = ?');
    values.push(updates.latest_code);
  }
  if (updates.latest_code_time) {
    fields.push('latest_code_time = ?');
    values.push(updates.latest_code_time);
  }

  values.push(accountId);
  await db.prepare(`UPDATE accounts SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
}

export async function deleteAccount(db: D1Database, userId: string, accountId: string): Promise<void> {
  await initDatabase(db);
  const acc = await db.prepare('SELECT email FROM accounts WHERE id = ? AND user_id = ?')
    .bind(accountId, userId)
    .first<{ email: string }>();

  if (acc) {
    await db.prepare('DELETE FROM emails WHERE user_id = ? AND account_email = ?')
      .bind(userId, acc.email.toLowerCase())
      .run();
  }
  await db.prepare('DELETE FROM accounts WHERE id = ? AND user_id = ?')
    .bind(accountId, userId)
    .run();
}

export async function purgeDeadAccounts(db: D1Database, userId: string): Promise<number> {
  await initDatabase(db);
  const res = await db.prepare("DELETE FROM accounts WHERE user_id = ? AND status = 'dead'")
    .bind(userId)
    .run();
  return res.meta?.changes || 0;
}

// 4. 邮件缓存操作
export async function listEmailsByUser(
  db: D1Database,
  userId: string,
  options?: { accountEmail?: string; isJunk?: boolean; hasCode?: boolean; unreadOnly?: boolean; search?: string; limit?: number; offset?: number }
): Promise<DbEmail[]> {
  await initDatabase(db);
  let query = 'SELECT * FROM emails WHERE user_id = ?';
  const params: any[] = [userId];

  if (options?.accountEmail) {
    query += ' AND account_email = ?';
    params.push(options.accountEmail.toLowerCase());
  }

  if (options?.isJunk !== undefined) {
    query += ' AND is_junk = ?';
    params.push(options.isJunk ? 1 : 0);
  }

  if (options?.hasCode) {
    query += ' AND extracted_code IS NOT NULL AND extracted_code != ""';
  }

  if (options?.unreadOnly) {
    query += ' AND is_read = 0';
  }

  if (options?.search) {
    const s = `%${options.search.toLowerCase()}%`;
    query += ' AND (LOWER(subject) LIKE ? OR LOWER(sender_name) LIKE ? OR LOWER(sender_address) LIKE ? OR LOWER(body_preview) LIKE ? OR LOWER(extracted_code) LIKE ?)';
    params.push(s, s, s, s, s);
  }

  query += ' ORDER BY received_at DESC LIMIT ? OFFSET ?';
  params.push(options?.limit || 200, Math.max(0, options?.offset || 0));

  const res = await db.prepare(query).bind(...params).all<DbEmail>();
  return res.results || [];
}

export async function saveEmails(db: D1Database, emails: DbEmail[]): Promise<void> {
  if (emails.length === 0) return;
  await initDatabase(db);

  for (const mail of emails) {
    await db.prepare(cleanSql(`
      INSERT INTO emails (
        id, user_id, account_email, subject, sender_name, sender_address,
        received_at, body_preview, body_html, extracted_code, is_junk, is_read, raw_headers
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        subject = excluded.subject,
        body_preview = excluded.body_preview,
        body_html = excluded.body_html,
        extracted_code = COALESCE(excluded.extracted_code, emails.extracted_code)
    `)).bind(
      mail.id,
      mail.user_id,
      mail.account_email,
      mail.subject,
      mail.sender_name,
      mail.sender_address,
      mail.received_at,
      mail.body_preview,
      mail.body_html || null,
      mail.extracted_code || null,
      mail.is_junk,
      mail.is_read,
      mail.raw_headers || null
    ).run();
  }
}

export async function updateEmailReadStatus(db: D1Database, userId: string, emailId: string, isRead: boolean): Promise<void> {
  await initDatabase(db);
  await db.prepare('UPDATE emails SET is_read = ? WHERE id = ? AND user_id = ?')
    .bind(isRead ? 1 : 0, emailId, userId)
    .run();
}

export async function deleteEmail(db: D1Database, userId: string, emailId: string): Promise<void> {
  await initDatabase(db);
  await db.prepare('DELETE FROM emails WHERE id = ? AND user_id = ?')
    .bind(emailId, userId)
    .run();
}
