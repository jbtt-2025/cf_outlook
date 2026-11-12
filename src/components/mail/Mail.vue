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

      <div class="flex items-center space-x-3">
        <!-- 统计微标 -->
        <div class="hidden sm:flex items-center space-x-2 text-xs text-zinc-500">
          <span>总邮箱: <b class="text-zinc-800 dark:text-zinc-200 font-mono">{{ accounts.length }}</b></span>
          <span>·</span>
          <span>总邮件: <b class="text-zinc-800 dark:text-zinc-200 font-mono">{{ allEmails.length }}</b></span>
        </div>

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

    <!-- 弹窗 1: 批量导入凭证 -->
    <ImportModal
      :show="showImportModal"
      @close="showImportModal = false"
      @imported="handleImported"
    />

    <!-- 弹窗 2: 导出滚动凭证 -->
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
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { db, type OutlookAccount, type StoredEmail } from '../../db';
import { scheduler } from '../../services/scheduler';

import AccountSwitcher from './AccountSwitcher.vue';
import MailNav from './MailNav.vue';
import MailList from './MailList.vue';
import MailDisplay from './MailDisplay.vue';
import AccountManager from './AccountManager.vue';
import ImportModal from '../modals/ImportModal.vue';
import ExportModal from '../modals/ExportModal.vue';

// 状态定义
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

// 筛选出的邮件列表（聚合 vs 单号，收件箱 vs 验证码雷达 vs 垃圾箱）
const displayedEmails = computed(() => {
  let list = allEmails.value;

  // 1. 过滤当前选中的账号
  if (selectedAccount.value) {
    list = list.filter(e => e.account_email === selectedAccount.value!.email.toLowerCase());
  }

  // 2. 根据左侧导航视图过滤
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

// 重新加载数据库数据
async function loadData() {
  accounts.value = await db.accounts.toArray();
  allEmails.value = await db.emails.orderBy('received_at').reverse().toArray();

  // 如果选中的邮件不存在了，清空或重置
  if (selectedEmail.value) {
    const stillExists = allEmails.value.find(e => e.id === selectedEmail.value!.id);
    selectedEmail.value = stillExists || null;
  }
}

function showToast(msg: string) {
  toastMessage.value = msg;
  setTimeout(() => {
    if (toastMessage.value === msg) toastMessage.value = null;
  }, 2500);
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
    loadData();
  }
}

async function handleToggleRead(email: StoredEmail) {
  const newRead = !email.is_read;
  await db.emails.update(email.id, { is_read: newRead });
  email.is_read = newRead;
  loadData();
}

async function handleDeleteEmail(id: string) {
  await db.emails.delete(id);
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
  showToast('开始全量并发体检...');
  await scheduler.checkAll();
}

async function handleCheckOne(id: string) {
  showToast(`正在检测账号: ${id}`);
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
  if (!confirm(`确定要彻底删除账号 ${id} 及其所有本地缓存的邮件吗？`)) return;
  await db.accounts.delete(id);
  await db.emails.where('account_email').equals(id.toLowerCase()).delete();
  if (selectedAccount.value?.id === id) {
    selectedAccount.value = null;
  }
  showToast('账号及本地邮件已彻底删除');
  loadData();
}

async function handlePurgeDead() {
  const deadAccounts = accounts.value.filter(a => a.status === 'dead');
  if (deadAccounts.length === 0) {
    showToast('当前没有失效死号');
    return;
  }

  if (!confirm(`确认要物理清理全部 ${deadAccounts.length} 个失效死号吗？操作不可恢复。`)) return;

  for (const acc of deadAccounts) {
    await db.accounts.delete(acc.id);
    await db.emails.where('account_email').equals(acc.email.toLowerCase()).delete();
  }

  showToast(`已成功清理 ${deadAccounts.length} 个失效账号`);
  loadData();
}

function handleImported(count: number) {
  showToast(`成功导入并持久化 ${count} 个账号凭证！`);
  loadData();
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

  await loadData();

  // 监听调度器状态与结果
  unsubscribeScheduler = scheduler.subscribe(() => {
    runningJobs.value = scheduler.getRunningCount();
    isPolling.value = scheduler.isAutoPolling();
    loadData();
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
