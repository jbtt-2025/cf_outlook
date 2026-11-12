<template>
  <div class="relative p-3 border-b border-zinc-200 dark:border-zinc-800">
    <div class="flex items-center justify-between mb-2">
      <span class="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
        当前工作空间
      </span>
      <span class="text-[11px] px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono">
        {{ accounts.length }} 个邮箱
      </span>
    </div>

    <!-- 账号下拉/选择器主按钮 -->
    <div class="relative">
      <button
        @click="isOpen = !isOpen"
        class="w-full flex items-center justify-between px-3 py-2 bg-zinc-100 dark:bg-zinc-800/80 hover:bg-zinc-200/80 dark:hover:bg-zinc-700/60 rounded-lg text-left transition border border-transparent dark:border-zinc-700/50"
      >
        <div class="flex items-center space-x-2.5 min-w-0">
          <!-- 状态小圆点 -->
          <span
            class="w-2.5 h-2.5 rounded-full shrink-0"
            :class="selectedAccount ? getStatusDotClass(selectedAccount.status) : 'bg-blue-500'"
          ></span>
          <div class="truncate">
            <div class="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">
              {{ selectedAccount ? selectedAccount.email : '聚合收件箱 (全部账号)' }}
            </div>
            <div class="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 truncate">
              <span>{{ selectedAccount ? getStatusLabel(selectedAccount.status) : `${totalUnread} 封未读` }}</span>
              <span v-if="selectedAccount?.unread_count" class="text-blue-600 dark:text-blue-400 font-medium">
                · {{ selectedAccount.unread_count }} 未读
              </span>
            </div>
          </div>
        </div>

        <svg class="w-4 h-4 text-zinc-400 shrink-0 ml-1 transition-transform" :class="{ 'rotate-180': isOpen }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
        </svg>
      </button>

      <!-- 下拉弹窗 -->
      <div
        v-if="isOpen"
        class="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl overflow-hidden"
      >
        <!-- 搜索过滤 -->
        <div class="p-2 border-b border-zinc-100 dark:border-zinc-800">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索邮箱或标签..."
            class="w-full px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div class="max-h-64 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60">
          <!-- 聚合收件箱选项 -->
          <button
            @click="select(null)"
            class="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
            :class="{ 'bg-blue-50/60 dark:bg-blue-950/40': selectedAccount === null }"
          >
            <div class="flex items-center space-x-2">
              <span class="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0"></span>
              <span class="text-xs font-semibold text-zinc-800 dark:text-zinc-200">聚合收件箱 (全部账号)</span>
            </div>
            <span class="text-[11px] text-zinc-400 font-mono">{{ totalUnread }} 未读</span>
          </button>

          <!-- 账号列表 (限制前 50 项，保障 10,000 级数据秒开无卡顿) -->
          <button
            v-for="acc in displayedAccounts"
            :key="acc.id"
            @click="select(acc)"
            class="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
            :class="{ 'bg-blue-50/60 dark:bg-blue-950/40': selectedAccount?.id === acc.id }"
          >
            <div class="flex items-center space-x-2 min-w-0 pr-2">
              <span class="w-2.5 h-2.5 rounded-full shrink-0" :class="getStatusDotClass(acc.status)"></span>
              <div class="truncate">
                <div class="text-xs text-zinc-800 dark:text-zinc-200 truncate">{{ acc.email }}</div>
                <div class="text-[10px] text-zinc-400 flex items-center gap-1">
                  <span>{{ getStatusLabel(acc.status) }}</span>
                  <span v-if="acc.latest_code" class="text-blue-500 font-mono">⚡ {{ acc.latest_code }}</span>
                </div>
              </div>
            </div>

            <span v-if="acc.unread_count" class="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-medium shrink-0">
              {{ acc.unread_count }}
            </span>
          </button>

          <div v-if="filteredAccounts.length > 50" class="p-2 text-center text-[11px] text-zinc-400 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-800/40 border-t border-zinc-100 dark:border-zinc-800">
            显示前 50 个匹配项 (共 {{ filteredAccounts.length }} 个)，输入关键词精准查找
          </div>

          <div v-if="filteredAccounts.length === 0 && accounts.length > 0" class="p-3 text-center text-xs text-zinc-400">
            无匹配账号
          </div>
          <div v-if="accounts.length === 0" class="p-4 text-center text-xs text-zinc-400">
            暂无账号，请点击下方「+ 批量导入」
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { OutlookAccount, AccountStatus } from '../../db';

const props = defineProps<{
  accounts: OutlookAccount[];
  selectedAccount: OutlookAccount | null;
  totalUnread: number;
}>();

const emit = defineEmits<{
  (e: 'select', account: OutlookAccount | null): void;
}>();

const isOpen = ref(false);
const searchQuery = ref('');

const filteredAccounts = computed(() => {
  if (!searchQuery.value.trim()) return props.accounts;
  const q = searchQuery.value.toLowerCase();
  return props.accounts.filter(a =>
    a.email.toLowerCase().includes(q) ||
    a.tags?.some(t => t.toLowerCase().includes(q))
  );
});

// 优化 10000 级海量邮箱下拉性能：最多展示前 50 条匹配项，毫秒级响应
const displayedAccounts = computed(() => filteredAccounts.value.slice(0, 50));

function select(account: OutlookAccount | null) {
  emit('select', account);
  isOpen.value = false;
}

function getStatusDotClass(status: AccountStatus) {
  switch (status) {
    case 'active': return 'bg-emerald-500';
    case 'empty': return 'bg-amber-400';
    case 'fetching':
    case 'refreshing': return 'bg-purple-500 animate-pulse';
    case 'dead': return 'bg-rose-500';
    case 'rate_limited': return 'bg-orange-500';
    default: return 'bg-zinc-400';
  }
}

function getStatusLabel(status: AccountStatus) {
  switch (status) {
    case 'active': return '正常活跃';
    case 'empty': return '邮箱为空';
    case 'fetching': return '正在拉取...';
    case 'refreshing': return '刷新凭证中...';
    case 'dead': return '凭据已失效';
    case 'rate_limited': return '请求受限 (429)';
    default: return '就绪';
  }
}
</script>
