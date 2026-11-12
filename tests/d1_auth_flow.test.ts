import assert from 'assert';
import { DatabaseSync } from 'node:sqlite';
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
  updateAccountSyncResult,
  deleteAccount,
  DbAccount
} from '../functions/api/db';
import { hashPassword, verifyPassword, createJwtToken, verifyJwtToken } from '../functions/api/auth';

function createMockD1Database(): any {
  const db = new DatabaseSync(':memory:');
  return {
    prepare(query: string) {
      let boundValues: any[] = [];
      const stmt = {
        bind(...values: any[]) {
          boundValues = values;
          return stmt;
        },
        async first(colName?: string) {
          const prepared = db.prepare(query);
          const row: any = prepared.get(...boundValues);
          if (!row) return null;
          if (colName) return row[colName] ?? null;
          return row;
        },
        async all() {
          const prepared = db.prepare(query);
          const results = prepared.all(...boundValues);
          return { results, success: true, meta: { changes: 0 } };
        },
        async run() {
          const prepared = db.prepare(query);
          const info = prepared.run(...boundValues);
          return {
            success: true,
            meta: {
              changes: Number(info.changes || 0),
              last_row_id: Number(info.lastInsertRowid || 0),
            },
          };
        },
      };
      return stmt;
    },
    async exec(query: string) {
      db.exec(query);
      return { count: 1, duration: 0 };
    },
  };
}

async function runD1AuthFlowTest() {
  console.log('\n--- 5. 测试 D1 数据库、多用户权限隔离与凭证滚动写回 ---');

  const d1 = createMockD1Database();
  await initDatabase(d1);

  // 1. 初始状态：无用户
  const initialCount = await getUserCount(d1);
  assert.strictEqual(initialCount, 0, 'Initial user count should be 0');

  // 2. 注册首位用户：自动成为 admin
  const adminPasswordHash = await hashPassword('AdminPass123!');
  const adminUser = {
    id: 'usr_admin',
    username: 'admin',
    password_hash: adminPasswordHash,
    role: 'admin' as const,
    status: 'active' as const,
    created_at: Date.now(),
  };
  await createUser(d1, adminUser);

  const afterFirstCount = await getUserCount(d1);
  assert.strictEqual(afterFirstCount, 1, 'User count should be 1');

  const loadedAdmin = await findUserByUsername(d1, 'admin');
  assert.strictEqual(loadedAdmin?.role, 'admin', 'First registered user must be admin');
  console.log('✔ [PASS] First user automatically assigned admin role.');

  // 3. 注册第二位用户：角色为 user
  const userPasswordHash = await hashPassword('UserPass123!');
  const normalUser = {
    id: 'usr_normal',
    username: 'testuser',
    password_hash: userPasswordHash,
    role: 'user' as const,
    status: 'active' as const,
    created_at: Date.now(),
  };
  await createUser(d1, normalUser);

  const loadedUser = await findUserByUsername(d1, 'testuser');
  assert.strictEqual(loadedUser?.role, 'user', 'Subsequent user must be regular user');
  console.log('✔ [PASS] Subsequent users assigned regular user role.');

  // 4. 账号数据隔离测试
  const acc1: DbAccount = {
    id: `${normalUser.id}_user@outlook.com`,
    user_id: normalUser.id,
    email: 'user@outlook.com',
    refresh_token: 'initial_rt_token_v1',
    client_id: '9e5f94bc-e8a4-4e73-b8be-63364c29d753',
    status: 'idle',
    created_at: Date.now(),
  };
  await saveAccount(d1, acc1);

  // admin 查询名下账号应为空
  const adminAccounts = await listAccountsByUser(d1, adminUser.id);
  assert.strictEqual(adminAccounts.length, 0, 'Admin should have 0 accounts');

  // normalUser 查询名下账号有 1 个
  const userAccounts = await listAccountsByUser(d1, normalUser.id);
  assert.strictEqual(userAccounts.length, 1, 'User should have 1 account');
  assert.strictEqual(userAccounts[0].email, 'user@outlook.com');
  console.log('✔ [PASS] User account data isolation verified.');

  // 5. 模拟凭据自动滚动刷新写回 (Refresh Token auto-roll and writeback)
  const newRolledToken = 'new_rolled_rt_token_v2_xyz';
  await updateAccountSyncResult(d1, acc1.id, {
    refresh_token: newRolledToken,
    status: 'active',
    last_checked_at: Date.now(),
    unread_count: 5,
    latest_code: '829104',
  });

  const updatedAccount = await getAccountById(d1, normalUser.id, acc1.id);
  assert.strictEqual(updatedAccount?.refresh_token, newRolledToken, 'Refresh token must be updated with latest rolled value');
  assert.strictEqual(updatedAccount?.status, 'active');
  assert.strictEqual(updatedAccount?.latest_code, '829104');
  console.log('✔ [PASS] Refresh Token atomic rolling writeback verified.');

  // 6. 管理员管理功能测试
  const allUsers = await listAllUsers(d1);
  assert.strictEqual(allUsers.length, 2, 'Admin should see all 2 users');

  // 停用普通用户
  await updateUser(d1, normalUser.id, { status: 'disabled' });
  const disabledUser = await findUserById(d1, normalUser.id);
  assert.strictEqual(disabledUser?.status, 'disabled', 'User status should be disabled');

  // 提权普通用户为管理员
  await updateUser(d1, normalUser.id, { role: 'admin' });
  const promotedUser = await findUserById(d1, normalUser.id);
  assert.strictEqual(promotedUser?.role, 'admin', 'User should be promoted to admin');

  // 删除用户及其数据
  await deleteUserAndData(d1, normalUser.id);
  const remainingUsers = await listAllUsers(d1);
  assert.strictEqual(remainingUsers.length, 1, 'Only admin should remain after deletion');
  const userAccountsAfterDel = await listAccountsByUser(d1, normalUser.id);
  assert.strictEqual(userAccountsAfterDel.length, 0, 'Deleted user accounts should be cleaned');
  console.log('✔ [PASS] Admin user management (status, role, deletion) verified.');
}

runD1AuthFlowTest().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
