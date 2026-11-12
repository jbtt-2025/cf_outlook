<template>
  <div class="flex flex-col h-full bg-white dark:bg-zinc-950">
    <!-- 头部工具栏 -->
    <div class="p-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <span>👥</span> 账号管理
        </h2>
        <p class="text-xs text-zinc-500 mt-0.5">共 {{ accounts.length }} 个账号</p>
      </div>

      <div class="flex items-center space-x-2">
        <!-- 批量复制当前筛选出的邮箱 -->
        <button
          @click="copyAllFilteredEmails"
          :disabled="filteredList.length === 0"
          class="px-2.5 py-1.5 text-xs bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 rounded-lg transition disabled:opacity-50 flex items-center gap-1.5 shrink-0"
          title="一键复制当前筛选出的所有邮箱账号（换行分隔）"
        >
          <span>📋</span>
          <span>{{ batchCopied ? '已复制全部 ✔' : `复制邮箱 (${filteredList.length})` }}</span>
        </button>

        <input
          v-model="search"
          type="text"
          placeholder="搜索邮箱或标签..."
          class="px-3 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />

        <select
          v-model="statusFilter"
          class="px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-800 dark:text-zinc-200 focus:outline-none"
        >
          <option value="all">全部状态</option>
          <option value="active">正常活跃</option>
          <option value="empty">空箱待命</option>
          <option value="dead">失效死号</option>
          <option value="rate_limited">限流冷却</option>
          <option value="idle">待命</option>
        </select>
      </div>
    </div>

    <!-- 列表数据表格 -->
    <div class="flex-1 overflow-auto">
      <table class="w-full text-left text-xs border-collapse">
        <thead class="bg-zinc-50 dark:bg-zinc-900/80 text-zinc-500 dark:text-zinc-400 sticky top-0 border-b border-zinc-200 dark:border-zinc-800 backdrop-blur-sm z-10">
          <tr>
            <th class="py-2.5 px-4 font-semibold">状态</th>
            <th class="py-2.5 px-4 font-semibold">邮箱账号</th>
            <th class="py-2.5 px-4 font-semibold">最新提取验证码</th>
            <th class="py-2.5 px-4 font-semibold">最后检测时间</th>
            <th class="py-2.5 px-4 font-semibold">Client ID</th>
            <th class="py-2.5 px-4 font-semibold">标签</th>
            <th class="py-2.5 px-4 font-semibold text-right">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-zinc-100 dark:divide-zinc-800/60 text-zinc-800 dark:text-zinc-200">
          <tr
            v-for="acc in filteredList"
            :key="acc.id"
            class="hover:bg-zinc-50/80 dark:hover:bg-zinc-900/50 transition group"
          >
            <!-- 状态 -->
            <td class="py-2.5 px-4 whitespace-nowrap">
              <span
                class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium"
                :class="getStatusBadgeClass(acc.status)"
                :title="acc.dead_reason || ''"
              >
                <span class="w-1.5 h-1.5 rounded-full shrink-0" :class="getStatusDotColor(acc.status)"></span>
                {{ getStatusText(acc.status) }}
              </span>
            </td>

            <!-- 邮箱账号（带一键快捷复制图标） -->
            <td class="py-2.5 px-4 font-medium select-all">
              <div class="flex items-center space-x-1.5">
                <span class="font-mono text-zinc-900 dark:text-zinc-100">{{ acc.email }}</span>
                <!-- 邮箱旁边的一键快捷复制小按钮 -->
                <button
                  @click.stop="copyEmail(acc.email)"
                  class="p-1 text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  :title="copiedEmail === acc.email ? '已复制！' : '一键复制此邮箱'"
                >
                  <span v-if="copiedEmail === acc.email" class="text-emerald-500 font-bold text-xs">✔</span>
                  <span v-else class="text-xs">📋</span>
                </button>

                <span v-if="acc.unread_count" class="text-[10px] px-1.5 py-0.2 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded-full font-bold">
                  {{ acc.unread_count }}
                </span>
              </div>
              <div v-if="acc.dead_reason" class="text-[10px] text-rose-500 dark:text-rose-400 truncate max-w-xs" :title="acc.dead_reason">
                原因: {{ acc.dead_reason }}
              </div>
            </td>

            <!-- 最新验证码 -->
            <td class="py-2.5 px-4 font-mono">
              <div v-if="acc.latest_code" class="inline-flex items-center space-x-1 px-2 py-0.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded text-blue-700 dark:text-blue-300 font-bold">
                <span>⚡ {{ acc.latest_code }}</span>
                <button
                  @click="copy(acc.latest_code)"
                  class="ml-1 text-[10px] opacity-70 hover:opacity-100"
                  title="复制验证码"
                >
                  📋
                </button>
              </div>
              <span v-else class="text-zinc-400 text-[11px]">-</span>
            </td>

            <!-- 最后检测时间 -->
            <td class="py-2.5 px-4 text-zinc-500 text-[11px] whitespace-nowrap">
              {{ acc.last_checked_at ? new Date(acc.last_checked_at).toLocaleTimeString() : '未检测' }}
            </td>

            <!-- Client ID -->
            <td class="py-2.5 px-4 font-mono text-[11px] text-zinc-400 truncate max-w-[120px]" :title="acc.client_id">
              {{ acc.client_id ? acc.client_id.slice(0, 8) + '...' : '默认' }}
            </td>

            <!-- 标签 -->
            <td class="py-2.5 px-4">
              <div class="flex flex-wrap gap-1">
                <span
                  v-for="tag in acc.tags"
                  :key="tag"
                  class="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded text-[10px]"
                >
                  {{ tag }}
                </span>
                <span v-if="!acc.tags || acc.tags.length === 0" class="text-zinc-400 text-[10px]">-</span>
              </div>
            </td>

            <!-- 操作 -->
            <td class="py-2.5 px-4 text-right whitespace-nowrap">
              <div class="flex items-center justify-end space-x-1.5">
                <button
                  @click="copyEmail(acc.email)"
                  class="px-2 py-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded text-[11px] transition"
                  title="一键复制该邮箱地址"
                >
                  {{ copiedEmail === acc.email ? '已复制 ✔' : '复制邮箱' }}
                </button>
                <button
                  @click="$emit('check-one', acc.id)"
                  class="px-2 py-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded text-[11px] transition"
                  title="单独拉取该账号"
                >
                  同步
                </button>
                <button
                  @click="copy(acc.refresh_token)"
                  class="px-2 py-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded text-[11px] transition"
                  title="复制当前最新 Token"
                >
                  复制 Token
                </button>
                <button
                  @click="$emit('delete', acc.id)"
                  class="px-2 py-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded text-[11px] transition"
                  title="删除该账号"
                >
                  删除
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- 空白占位 -->
      <div v-if="filteredList.length === 0" class="p-12 text-center text-xs text-zinc-400 space-y-2">
        <p>暂无符合条件的账号</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { OutlookAccount, AccountStatus } from '../../db';

const props = defineProps<{
  accounts: OutlookAccount[];
}>();

defineEmits<{
  (e: 'check-one', id: string): void;
  (e: 'delete', id: string): void;
}>();

const search = ref('');
const statusFilter = ref<string>('all');
const copiedEmail = ref<string | null>(null);
const batchCopied = ref(false);

const filteredList = computed(() => {
  let list = props.accounts;

  if (statusFilter.value !== 'all') {
    list = list.filter(a => a.status === statusFilter.value);
  }

  if (search.value.trim()) {
    const q = search.value.toLowerCase().trim();
    list = list.filter(a =>
      a.email.toLowerCase().includes(q) ||
      a.tags?.some(t => t.toLowerCase().includes(q)) ||
      a.latest_code?.toLowerCase().includes(q)
    );
  }

  return list;
});

function getStatusBadgeClass(status: AccountStatus) {
  switch (status) {
    case 'active':
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60';
    case 'empty':
      return 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60';
    case 'fetching':
    case 'refreshing':
      return 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200 dark:border-purple-900/60';
    case 'dead':
      return 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60';
    case 'rate_limited':
      return 'bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300 border border-orange-200 dark:border-orange-900/60';
    default:
      return 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400';
  }
}

function getStatusDotColor(status: AccountStatus) {
  switch (status) {
    case 'active': return 'bg-emerald-500';
    case 'empty': return 'bg-amber-500';
    case 'fetching':
    case 'refreshing': return 'bg-purple-500 animate-pulse';
    case 'dead': return 'bg-rose-500';
    case 'rate_limited': return 'bg-orange-500';
    default: return 'bg-zinc-400';
  }
}

function getStatusText(status: AccountStatus) {
  switch (status) {
    case 'active': return '正常活跃';
    case 'empty': return '空箱';
    case 'fetching': return '拉取中...';
    case 'refreshing': return '刷新凭证...';
    case 'dead': return '失效 (Dead)';
    case 'rate_limited': return '限流 (429)';
    default: return '待命';
  }
}

function copy(text: string) {
  navigator.clipboard.writeText(text);
}

function copyEmail(email: string) {
  navigator.clipboard.writeText(email);
  copiedEmail.value = email;
  setTimeout(() => {
    if (copiedEmail.value === email) copiedEmail.value = null;
  }, 2000);
}

function copyAllFilteredEmails() {
  const text = filteredList.value.map(a => a.email).join('\n');
  if (!text) return;
  navigator.clipboard.writeText(text);
  batchCopied.value = true;
  setTimeout(() => (batchCopied.value = false), 2000);
}
</script>
