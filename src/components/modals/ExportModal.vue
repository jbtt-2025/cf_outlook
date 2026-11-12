<template>
  <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
    <div class="w-full max-w-xl bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[90vh] overflow-hidden">
      <!-- 头部 -->
      <div class="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <div>
          <h3 class="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span>💾</span> 导出账号与滚动凭证
          </h3>
          <p class="text-xs text-zinc-500 mt-0.5">导出的文件 100% 包含微软签发的最新滚动 Refresh Token</p>
        </div>
        <button
          @click="$emit('close')"
          class="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg p-1"
        >
          ✕
        </button>
      </div>

      <!-- 内容主体 -->
      <div class="p-6 overflow-y-auto space-y-4 text-xs">
        <!-- 筛选与格式选项 -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">导出范围：</label>
            <select
              v-model="scope"
              class="w-full p-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md text-zinc-800 dark:text-zinc-200 focus:outline-none"
            >
              <option value="all">全部账号 ({{ accounts.length }})</option>
              <option value="active">仅正常活跃账号 ({{ activeCount }})</option>
              <option value="dead">仅失效死号 ({{ deadCount }})</option>
              <option value="empty">仅空箱账号 ({{ emptyCount }})</option>
            </select>
          </div>

          <div>
            <label class="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">导出格式：</label>
            <select
              v-model="format"
              class="w-full p-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md text-zinc-800 dark:text-zinc-200 focus:outline-none"
            >
              <option value="two_parts">极简两段式 (email----rt)</option>
              <option value="four_parts">经典四段式 (email----pwd----client----rt)</option>
              <option value="jsonl">JSON Lines (.jsonl)</option>
              <option value="csv">逗号分隔符 (.csv)</option>
            </select>
          </div>
        </div>

        <!-- 文本预览框 -->
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <span class="font-semibold text-zinc-700 dark:text-zinc-300">
              数据预览（共 {{ targetAccounts.length }} 行）：
            </span>
            <span class="text-zinc-400 font-mono">{{ format.toUpperCase() }}</span>
          </div>
          <textarea
            readonly
            rows="8"
            :value="exportContent"
            class="w-full p-3 font-mono text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-800 dark:text-zinc-200 focus:outline-none select-all"
          ></textarea>
        </div>
      </div>

      <!-- 模态框底部按钮 -->
      <div class="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 flex items-center justify-between">
        <div class="text-zinc-400 text-[11px]">
          共选中 {{ targetAccounts.length }} 个凭据
        </div>
        <div class="flex items-center space-x-2.5">
          <button
            @click="copyToClipboard"
            :disabled="targetAccounts.length === 0"
            class="px-4 py-2 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-lg text-xs font-medium transition disabled:opacity-50"
          >
            {{ copied ? '已复制到剪贴板 ✔' : '复制到剪贴板' }}
          </button>
          <button
            @click="downloadFile"
            :disabled="targetAccounts.length === 0"
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50"
          >
            下载文件 (.{{ getFileExt() }})
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { OutlookAccount } from '../../db';

const props = defineProps<{
  show: boolean;
  accounts: OutlookAccount[];
}>();

defineEmits<{
  (e: 'close'): void;
}>();

const scope = ref<'all' | 'active' | 'dead' | 'empty'>('all');
const format = ref<'two_parts' | 'four_parts' | 'jsonl' | 'csv'>('two_parts');
const copied = ref(false);

const activeCount = computed(() => props.accounts.filter(a => a.status === 'active').length);
const deadCount = computed(() => props.accounts.filter(a => a.status === 'dead').length);
const emptyCount = computed(() => props.accounts.filter(a => a.status === 'empty').length);

const targetAccounts = computed(() => {
  switch (scope.value) {
    case 'active':
      return props.accounts.filter(a => a.status === 'active');
    case 'dead':
      return props.accounts.filter(a => a.status === 'dead');
    case 'empty':
      return props.accounts.filter(a => a.status === 'empty');
    default:
      return props.accounts;
  }
});

const exportContent = computed(() => {
  const list = targetAccounts.value;
  if (list.length === 0) return '';

  switch (format.value) {
    case 'two_parts':
      return list.map(a => `${a.email}----${a.refresh_token}`).join('\n');

    case 'four_parts':
      return list.map(a => `${a.email}----${a.password || ''}----${a.client_id || ''}----${a.refresh_token}`).join('\n');

    case 'jsonl':
      return list.map(a => JSON.stringify({
        email: a.email,
        password: a.password || null,
        client_id: a.client_id || null,
        refresh_token: a.refresh_token,
        status: a.status,
        tags: a.tags || [],
        last_checked_at: a.last_checked_at ? new Date(a.last_checked_at).toISOString() : null,
      })).join('\n');

    case 'csv': {
      const header = 'email,password,client_id,refresh_token,status,tags';
      const rows = list.map(a => {
        const email = `"${a.email}"`;
        const pwd = `"${(a.password || '').replace(/"/g, '""')}"`;
        const cid = `"${a.client_id || ''}"`;
        const rt = `"${a.refresh_token.replace(/"/g, '""')}"`;
        const st = `"${a.status}"`;
        const tags = `"${(a.tags || []).join(';')}"`;
        return `${email},${pwd},${cid},${rt},${st},${tags}`;
      });
      return [header, ...rows].join('\n');
    }
  }
});

function getFileExt() {
  switch (format.value) {
    case 'jsonl': return 'jsonl';
    case 'csv': return 'csv';
    default: return 'txt';
  }
}

function copyToClipboard() {
  navigator.clipboard.writeText(exportContent.value);
  copied.value = true;
  setTimeout(() => (copied.value = false), 2000);
}

function downloadFile() {
  const content = exportContent.value;
  if (!content) return;

  const ext = getFileExt();
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `outlook_accounts_${scope.value}_${dateStr}.${ext}`;

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
</script>
