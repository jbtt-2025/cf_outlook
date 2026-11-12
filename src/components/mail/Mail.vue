<template>
  <div class="flex flex-col h-screen w-screen overflow-hidden bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
    <!-- 顶部极简导航栏 -->
    <header class="h-12 border-b border-zinc-200 dark:border-zinc-800 px-4 flex items-center justify-between bg-zinc-50/80 dark:bg-zinc-900/50 backdrop-blur-sm shrink-0 select-none">
      <div class="flex items-center space-x-3">
        <div class="flex items-center space-x-2">
          <span class="text-xl">⚡</span>
          <span class="font-bold text-sm tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Outlook Graph 批量工作台
          </span>
        </div>
        <span class="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-mono font-medium">
          Cloudflare Pages Fullstack
        </span>
      </div>

      <div class="flex items-center space-x-2.5">
        <!-- 统计微标 -->
        <div class="hidden md:flex items-center space-x-2 text-xs text-zinc-500 mr-2">
          <span>总邮箱: <b class="text-zinc-800 dark:text-zinc-200 font-mono">{{ accounts.length }}</b></span>
          <span>·</span>
          <span>总邮件: <b class="text-zinc-800 dark:text-zinc-200 font-mono">{{ allEmails.length }}</b></span>
        </div>

        <!-- 用户登录与权限身份区域 -->
        <template v-if="currentUser">
          <!-- 用户名与角色 Badge -->
          <div class="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 text-xs font-medium">
            <span class="text-zinc-700 dark:text-zinc-200 font-semibold">{{ currentUser.username }}</span>
            <span
              v-if="currentUser.role === 'admin'"
              class="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300"
            >
              管理员
            </span>
            <span
              v-else
              class="text-[10px] px-1.5 py-0.2 rounded-full font-medium bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
            >
              普通用户
            </span>
          </div>

          <!-- 管理员控制台入口 (仅管理员可见) -->
          <button
            v-if="currentUser.role === 'admin'"
            @click="showAdminModal = true"
            class="px-2 py-1 rounded-lg text-xs font-medium bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 dark:hover:bg-purple-900 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 transition flex items-center space-x-1"
            title="打开超级管理员后台"
          >
            <span>🛡️</span>
            <span class="hidden sm:inline">用户管理</span>
          </button>

          <!-- 修改密码 -->
          <button
            @click="showPasswordModal = true"
            class="p-1.5 rounded-lg text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            title="修改个人密码"
          >
            <span>🔑</span>
          </button>

          <!-- 退出登录 -->
          <button
            @click="handleLogout"
            class="p-1.5 rounded-lg text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
            title="退出当前账号"
          >
            <span>🚪</span>
          </button>
        </template>

        <!-- 未登录状态按钮 -->
        <template v-else>
          <button
            @click="showAuthModal = true"
            class="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition shadow-sm"
          >
            登录 / 注册
          </button>
        </template>

        <div class="h-4 w-[1px] bg-zinc-200 dark:border-zinc-800 my-auto"></div>

        <!-- 暗黑模式切换 -->
        <button
          @click="toggleDarkMode"
          class="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition text-sm"
          :title="isDark ? '切换亮色模式' : '切换暗黑模式'"
        >
          <span v-if="isDark">☀️</span>
          <span v-else>🌙</span>
        </button>
      </div>
    </header>

    <!-- 三栏主布局工作台 (Shadcn Mail 3-column Layout) -->
    <main class="flex-1 flex overflow-hidden">
      <!-- 栏 1: 左侧导航栏与账号选择 (Width: 260px) -->
      <aside class="w-64 shrink-0 flex flex-col h-full bg-zinc-50/50 dark:bg-zinc-900/30">
        <AccountSwitcher
          :accounts="accounts"
          :selectedAccount="selectedAccount"
          :totalUnread="totalUnreadCount"
          @select="handleSelectAccount"
        />

        <MailNav
          class="flex-1 overflow-hidden"
          :activeFolder="activeFolder"
          :accounts="accounts"
          :unreadCount="totalUnreadCount"
          :codeCount="totalCodeCount"
          :junkCount="totalJunkCount"
          :isPolling="isPolling"
          :concurrency="concurrency"
          :pollInterval="pollInterval"
          :runningJobs="runningJobs"
          @update:activeFolder="activeFolder = $event"
          @update:concurrency="handleSetConcurrency"
          @update:pollInterval="handleSetPollInterval"
          @toggle-polling="handleTogglePolling"
          @open-import="showImportModal = true"
          @open-export="showExportModal = true"
          @check-all="handleCheckAll"
          @purge-dead="handlePurgeDead"
        />
      </aside>

      <!-- 栏 2 & 3 主展示区 -->
      <template v-if="activeFolder === 'accounts'">
        <!-- 账号管理专属全宽视图 -->
        <div class="flex-1 h-full overflow-hidden">
          <AccountManager
            :accounts="accounts"
            @check-one="handleCheckOne"
            @delete="handleDeleteAccount"
          />
        </div>
      </template>

      <template v-else>
        <!-- 栏 2: 中间邮件卡片列表 (Width: 340px) -->
        <section class="w-80 md:w-96 shrink-0 h-full overflow-hidden flex flex-col">
          <MailList
            :emails="displayedEmails"
            :selectedEmail="selectedEmail"
            :isRefreshing="isAccountRefreshing"
            @select="handleSelectEmail"
            @refresh-current="handleRefreshCurrent"
          />
        </section>

        <!-- 栏 3: 右侧正文沙箱阅读面板 (Flex-1) -->
        <section class="flex-1 h-full overflow-hidden">
          <MailDisplay
            :email="selectedEmail"
            @toggle-read="handleToggleRead"
            @delete="handleDeleteEmail"
          />
        </section>
      </template>
    </main>

    <!-- 弹窗 1: 用户认证模态框 (登录/注册/首任超管初始化) -->
    <AuthModal
      :show="showAuthModal"
      @login-success="handleLoginSuccess"
    />

    <!-- 弹窗 2: 管理员管控面板 -->
    <AdminPanelModal
      :show="showAdminModal"
      :currentUserId="currentUser?.id || ''"
      @close="showAdminModal = false"
    />

    <!-- 弹窗 3: 修改个人密码 -->
    <ChangePasswordModal
      :show="showPasswordModal"
      @close="showPasswordModal = false"
      @success="showToast('密码已成功修改！')"
    />

    <!-- 弹窗 4: 批量导入凭证 -->
    <ImportModal
      :show="showImportModal"
      @close="showImportModal = false"
      @imported="handleImported"
    />

    <!-- 弹窗 5: 导出滚动凭证 -->
    <ExportModal
      :show="showExportModal"
      :accounts="accounts"
      @close="showExportModal = false"
    />

    <!-- Toast 提示气泡 -->
    <transition name="fade">
      <div
        v-if="toastMessage"
        class="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-lg shadow-xl text-xs font-medium flex items-center space-x-2 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 border border-zinc-700/50"
      >
        <span>{{ toastMessage }}</span>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { db, type OutlookAccount, type StoredEmail } from '../../db';
import { scheduler } from '../../services/scheduler';
import { api, getStoredToken, setStoredToken } from '../../services/apiClient';

import AccountSwitcher from './AccountSwitcher.vue';
import MailNav from './MailNav.vue';
import MailList from './MailList.vue';
import MailDisplay from './MailDisplay.vue';
import AccountManager from './AccountManager.vue';
import ImportModal from '../modals/ImportModal.vue';
import ExportModal from '../modals/ExportModal.vue';
import AuthModal from '../modals/AuthModal.vue';
import AdminPanelModal from '../modals/AdminPanelModal.vue';
import ChangePasswordModal from '../modals/ChangePasswordModal.vue';

// 用户状态与弹窗
const currentUser = ref<any>(null);
const showAuthModal = ref(false);
const showAdminModal = ref(false);
const showPasswordModal = ref(false);

// 账号与邮件状态
const accounts = ref<OutlookAccount[]>([]);
const allEmails = ref<StoredEmail[]>([]);
const selectedAccount = ref<OutlookAccount | null>(null);
const selectedEmail = ref<StoredEmail | null>(null);
const activeFolder = ref<'inbox' | 'code_radar' | 'junk' | 'accounts'>('inbox');

// 调度器状态
const isPolling = ref(false);
const concurrency = ref(5);
const pollInterval = ref(180);
const runningJobs = ref(0);
const isAccountRefreshing = ref(false);

// 弹窗状态
const showImportModal = ref(false);
const showExportModal = ref(false);
const toastMessage = ref<string | null>(null);

// 暗黑模式
const isDark = ref(false);

function toggleDarkMode() {
  isDark.value = !isDark.value;
  if (isDark.value) {
    document.documentElement.classList.add('dark');
    localStorage.setItem('theme', 'dark');
  } else {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', 'light');
  }
}

// 筛选出的邮件列表
const displayedEmails = computed(() => {
  let list = allEmails.value;

  if (selectedAccount.value) {
    list = list.filter(e => e.account_email === selectedAccount.value!.email.toLowerCase());
  }

  if (activeFolder.value === 'code_radar') {
    list = list.filter(e => Boolean(e.extracted_code));
  } else if (activeFolder.value === 'junk') {
    list = list.filter(e => e.is_junk);
  } else if (activeFolder.value === 'inbox') {
    list = list.filter(e => !e.is_junk);
  }

  return list;
});

const totalUnreadCount = computed(() => allEmails.value.filter(e => !e.is_read && !e.is_junk).length);
const totalCodeCount = computed(() => allEmails.value.filter(e => Boolean(e.extracted_code)).length);
const totalJunkCount = computed(() => allEmails.value.filter(e => e.is_junk).length);

// 重新加载本地数据库数据
async function loadData() {
  accounts.value = await db.accounts.toArray();
  allEmails.value = await db.emails.orderBy('received_at').reverse().toArray();

  if (selectedEmail.value) {
    const stillExists = allEmails.value.find(e => e.id === selectedEmail.value!.id);
    selectedEmail.value = stillExists || null;
  }
}

// 同步服务端持久化数据至本地
async function syncWithRemote() {
  const token = getStoredToken();
  if (!token) return;

  try {
    // 1. 同步账号
    const accRes = await api.get('/api/accounts');
    if (accRes.success && accRes.accounts) {
      // 保持本地数据库与服务端同步
      await db.accounts.clear();
      for (const item of accRes.accounts) {
        await db.accounts.put({
          id: item.id,
          email: item.email,
          password: item.password,
          refresh_token: item.refresh_token,
          client_id: item.client_id,
          status: item.status as any,
          dead_reason: item.dead_reason,
          rate_limit_until: item.rate_limit_until,
          last_checked_at: item.last_checked_at,
          unread_count: item.unread_count,
          latest_code: item.latest_code,
          latest_code_time: item.latest_code_time,
          tags: item.tags ? (typeof item.tags === 'string' ? JSON.parse(item.tags) : item.tags) : [],
          created_at: item.created_at,
        });
      }
    }

    // 2. 同步邮件
    const emailRes = await api.get('/api/emails');
    if (emailRes.success && emailRes.emails) {
      await db.emails.clear();
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

    await loadData();
  } catch (err) {
    console.warn('Sync with remote failed:', err);
  }
}

function showToast(msg: string) {
  toastMessage.value = msg;
  setTimeout(() => {
    if (toastMessage.value === msg) toastMessage.value = null;
  }, 2500);
}

// 登录成功回调
async function handleLoginSuccess(user: any) {
  currentUser.value = user;
  showAuthModal.value = false;
  showToast(`欢迎回来，${user.username}！`);
  await syncWithRemote();
}

// 退出登录
async function handleLogout() {
  if (!confirm('确定要退出当前账号吗？')) return;
  setStoredToken(null);
  currentUser.value = null;
  accounts.value = [];
  allEmails.value = [];
  await db.accounts.clear();
  await db.emails.clear();
  selectedAccount.value = null;
  selectedEmail.value = null;
  showAuthModal.value = true;
  showToast('已安全退出登录');
}

// 交互处理
function handleSelectAccount(account: OutlookAccount | null) {
  selectedAccount.value = account;
  selectedEmail.value = null;
}

async function handleSelectEmail(email: StoredEmail) {
  selectedEmail.value = email;
  if (!email.is_read) {
    await db.emails.update(email.id, { is_read: true });
    email.is_read = true;
    api.post(`/api/emails/${email.id}/read`, { is_read: true }).catch(() => {});
    loadData();
  }
}

async function handleToggleRead(email: StoredEmail) {
  const newRead = !email.is_read;
  await db.emails.update(email.id, { is_read: newRead });
  email.is_read = newRead;
  api.post(`/api/emails/${email.id}/read`, { is_read: newRead }).catch(() => {});
  loadData();
}

async function handleDeleteEmail(id: string) {
  await db.emails.delete(id);
  api.delete(`/api/emails/${id}`).catch(() => {});
  if (selectedEmail.value?.id === id) {
    selectedEmail.value = null;
  }
  showToast('邮件已删除');
  loadData();
}

function handleSetConcurrency(val: number) {
  concurrency.value = val;
  scheduler.setConcurrency(val);
}

function handleSetPollInterval(val: number) {
  const sec = Math.max(10, Math.min(3600, val || 180));
  pollInterval.value = sec;
  localStorage.setItem('pollInterval', String(sec));
  scheduler.setPollInterval(sec);
  if (isPolling.value) {
    scheduler.startAutoPolling(sec);
  }
  showToast(`已设置自动拉取周期为 ${sec} 秒`);
}

function handleTogglePolling() {
  if (isPolling.value) {
    scheduler.stopAutoPolling();
    isPolling.value = false;
    showToast('已暂停自动轮询');
  } else {
    scheduler.startAutoPolling(pollInterval.value);
    isPolling.value = true;
    showToast(`已启动智能轮询调度 (每 ${pollInterval.value} 秒)`);
  }
}

async function handleCheckAll() {
  showToast('开始全量并发体检与凭证更新...');
  await scheduler.checkAll();
}

async function handleCheckOne(id: string) {
  showToast(`正在检测并同步: ${id}`);
  await scheduler.checkAccount(id);
}

async function handleRefreshCurrent() {
  if (selectedAccount.value) {
    isAccountRefreshing.value = true;
    await scheduler.checkAccount(selectedAccount.value.id);
    setTimeout(() => (isAccountRefreshing.value = false), 800);
  } else {
    await handleCheckAll();
  }
}

async function handleDeleteAccount(id: string) {
  if (!confirm(`确定要彻底删除账号 ${id} 吗？`)) return;
  await db.accounts.delete(id);
  await db.emails.where('account_email').equals(id.toLowerCase()).delete();
  api.delete(`/api/accounts/${id}`).catch(() => {});
  if (selectedAccount.value?.id === id) {
    selectedAccount.value = null;
  }
  showToast('账号及数据已彻底删除');
  loadData();
}

async function handlePurgeDead() {
  const deadAccounts = accounts.value.filter(a => a.status === 'dead');
  if (deadAccounts.length === 0) {
    showToast('当前没有失效死号');
    return;
  }

  if (!confirm(`确认要清理全部 ${deadAccounts.length} 个失效死号吗？操作不可恢复。`)) return;

  for (const acc of deadAccounts) {
    await db.accounts.delete(acc.id);
    await db.emails.where('account_email').equals(acc.email.toLowerCase()).delete();
  }
  api.post('/api/accounts/purge-dead').catch(() => {});

  showToast(`已成功清理 ${deadAccounts.length} 个失效账号`);
  loadData();
}

async function handleImported(count: number) {
  showToast(`成功导入并持久化 ${count} 个账号凭证！`);
  await syncWithRemote();
}

let unsubscribeScheduler: (() => void) | null = null;

onMounted(async () => {
  // 恢复主题设置
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    isDark.value = true;
    document.documentElement.classList.add('dark');
  }

  // 恢复自定义轮询周期设置 (默认 180S)
  const savedInterval = localStorage.getItem('pollInterval');
  if (savedInterval) {
    const val = Number(savedInterval);
    if (!isNaN(val) && val >= 10) {
      pollInterval.value = val;
      scheduler.setPollInterval(val);
    }
  } else {
    scheduler.setPollInterval(180);
  }

  // 校验登录状态
  const token = getStoredToken();
  if (token) {
    try {
      const meRes = await api.get('/api/auth/me');
      if (meRes.success && meRes.user) {
        currentUser.value = meRes.user;
        await syncWithRemote();
      } else {
        setStoredToken(null);
        showAuthModal.value = true;
      }
    } catch {
      setStoredToken(null);
      showAuthModal.value = true;
    }
  } else {
    showAuthModal.value = true;
  }

  await loadData();

  // 监听调度器状态与结果
  unsubscribeScheduler = scheduler.subscribe(() => {
    runningJobs.value = scheduler.getRunningCount();
    isPolling.value = scheduler.isAutoPolling();
    loadData();
  });

  // 监听未授权 401 事件
  window.addEventListener('auth:unauthorized', () => {
    currentUser.value = null;
    showAuthModal.value = true;
  });
});

onUnmounted(() => {
  if (unsubscribeScheduler) unsubscribeScheduler();
});
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
