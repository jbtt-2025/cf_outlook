<template>
  <div class="flex flex-col h-full bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800">
    <!-- 头部信息 -->
    <div v-if="email" class="p-4 border-b border-zinc-200 dark:border-zinc-800 space-y-3">
      <div class="flex items-start justify-between gap-4">
        <h2 class="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-100 leading-snug break-words">
          {{ email.subject || '(无主题)' }}
        </h2>
        <div class="flex items-center space-x-2 shrink-0">
          <span v-if="email.is_junk" class="px-2 py-0.5 text-xs bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 rounded font-medium">
            垃圾邮件 (Junk)
          </span>
          <button
            @click="$emit('toggle-read', email)"
            class="text-xs px-2.5 py-1 rounded border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            :title="email.is_read ? '标为未读' : '标为已读'"
          >
            {{ email.is_read ? '标为未读' : '标为已读' }}
          </button>
          <button
            @click="$emit('delete', email.id)"
            class="text-xs px-2.5 py-1 rounded border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
            title="删除此邮件"
          >
            删除
          </button>
        </div>
      </div>

      <div class="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-zinc-500 gap-1">
        <div class="flex flex-wrap items-center gap-1.5">
          <span class="font-medium text-zinc-800 dark:text-zinc-200">{{ email.sender_name || email.sender_address }}</span>
          <span class="text-zinc-400">&lt;{{ email.sender_address }}&gt;</span>
          <span class="text-zinc-300 dark:text-zinc-700">|</span>
          <span class="text-zinc-400">接收邮箱: {{ email.account_email }}</span>
        </div>
        <div class="text-zinc-400">{{ formatDate(email.received_at) }}</div>
      </div>

      <!-- 智能提取的验证码高亮卡片 -->
      <div v-if="email.extracted_code" class="p-3 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/80 rounded-lg flex items-center justify-between shadow-sm">
        <div class="flex items-center space-x-3">
          <span class="text-xs font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1">
            <span class="text-base">⚡</span> 提取到验证码:
          </span>
          <span class="font-mono text-2xl font-black tracking-widest text-blue-800 dark:text-blue-200 select-all">
            {{ email.extracted_code }}
          </span>
        </div>
        <button
          @click="copyCode(email.extracted_code)"
          class="px-3.5 py-1.5 text-xs font-medium rounded-md transition shadow-sm"
          :class="copied ? 'bg-emerald-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'"
        >
          {{ copied ? '已复制 ✔' : '一键复制' }}
        </button>
      </div>

      <!-- 视图切换与报头查看 -->
      <div class="flex items-center justify-between pt-1">
        <div class="flex space-x-1 border-b border-transparent">
          <button
            @click="activeView = 'html'"
            class="px-3 py-1 text-xs font-medium rounded-md transition"
            :class="activeView === 'html' ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'"
          >
            HTML 渲染
          </button>
          <button
            @click="activeView = 'text'"
            class="px-3 py-1 text-xs font-medium rounded-md transition"
            :class="activeView === 'text' ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'"
          >
            纯文本预览
          </button>
          <button
            v-if="email.raw_headers && email.raw_headers.length > 0"
            @click="activeView = 'headers'"
            class="px-3 py-1 text-xs font-medium rounded-md transition"
            :class="activeView === 'headers' ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'"
          >
            原始报头 ({{ email.raw_headers.length }})
          </button>
        </div>
      </div>
    </div>

    <!-- 邮件正文沙箱渲染区 -->
    <div class="flex-1 p-2 overflow-hidden relative">
      <template v-if="email">
        <!-- 1. HTML 沙箱视图 -->
        <iframe
          v-if="activeView === 'html'"
          ref="sandboxFrame"
          class="w-full h-full border-0 bg-white rounded"
          sandbox="allow-same-origin"
          :srcdoc="sanitizedHtml"
        ></iframe>

        <!-- 2. 纯文本视图 -->
        <div
          v-else-if="activeView === 'text'"
          class="w-full h-full p-4 overflow-auto font-mono text-sm whitespace-pre-wrap bg-zinc-50 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 rounded"
        >
          {{ email.body_preview || '(无纯文本内容)' }}
        </div>

        <!-- 3. RFC822 报头视图 -->
        <div
          v-else-if="activeView === 'headers'"
          class="w-full h-full p-4 overflow-auto font-mono text-xs bg-zinc-900 text-zinc-200 rounded"
        >
          <div class="flex justify-between items-center mb-2 pb-2 border-b border-zinc-800">
            <span class="font-semibold text-zinc-400">Internet Message Headers</span>
            <button
              @click="copyHeaders"
              class="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-xs"
            >
              {{ copiedHeaders ? '已复制' : '复制报头' }}
            </button>
          </div>
          <table class="w-full text-left border-collapse">
            <tbody>
              <tr v-for="(h, idx) in email.raw_headers" :key="idx" class="border-b border-zinc-800/60 hover:bg-zinc-800/40">
                <td class="py-1 pr-3 text-cyan-400 font-medium align-top select-all whitespace-nowrap">{{ h.name }}:</td>
                <td class="py-1 text-zinc-300 align-top break-all select-all">{{ h.value }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <div v-else class="h-full flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-600 gap-2">
        <svg class="w-12 h-12 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
        </svg>
        <span class="text-sm">在列表中选择一封邮件，即可在此查看正文与验证码</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import DOMPurify from 'dompurify';
import type { StoredEmail } from '../../db';

const props = defineProps<{ email?: StoredEmail | null }>();
defineEmits<{
  (e: 'toggle-read', email: StoredEmail): void;
  (e: 'delete', id: string): void;
}>();

const copied = ref(false);
const copiedHeaders = ref(false);
const activeView = ref<'html' | 'text' | 'headers'>('html');

const sanitizedHtml = computed(() => {
  if (!props.email) return '';
  const raw = props.email.body_html || `<pre style="white-space:pre-wrap;font-family:sans-serif;">${props.email.body_preview}</pre>`;
  // 使用 DOMPurify 消毒
  const clean = DOMPurify.sanitize(raw, { ADD_ATTR: ['target'] });
  const baseStyle = `<style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #18181b;
      padding: 16px;
      margin: 0;
      word-break: break-word;
    }
    img { max-width: 100%; height: auto; }
    a { color: #2563eb; }
  </style>`;
  return `${baseStyle}${clean}`;
});

function copyCode(code: string) {
  navigator.clipboard.writeText(code);
  copied.value = true;
  setTimeout(() => (copied.value = false), 2000);
}

function copyHeaders() {
  if (!props.email?.raw_headers) return;
  const text = props.email.raw_headers.map(h => `${h.name}: ${h.value}`).join('\n');
  navigator.clipboard.writeText(text);
  copiedHeaders.value = true;
  setTimeout(() => (copiedHeaders.value = false), 2000);
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  } catch {
    return iso;
  }
}
</script>
