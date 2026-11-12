<template>
  <div class="flex flex-col h-full bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800">
    <!-- 顶部搜索栏与刷新 -->
    <div class="p-3 border-b border-zinc-200 dark:border-zinc-800 space-y-2">
      <div class="flex items-center space-x-2">
        <div class="relative flex-1">
          <svg class="w-4 h-4 absolute left-2.5 top-2.5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索发件人、主题、验证码..."
            class="w-full pl-8 pr-3 py-1.5 text-xs bg-zinc-100 dark:bg-zinc-900 border border-transparent focus:border-blue-500 rounded-lg text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none transition"
          />
        </div>
        <button
          @click="$emit('refresh-current')"
          :disabled="isRefreshing"
          class="p-2 rounded-lg text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition disabled:opacity-50"
          :title="isRefreshing ? '正在同步...' : '刷新当前邮箱邮件'"
        >
          <svg class="w-4 h-4" :class="{ 'animate-spin': isRefreshing }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
          </svg>
        </button>
      </div>

      <!-- 子过滤 Tab (All / Unread / Code Radar) -->
      <div class="flex items-center space-x-1 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-lg text-xs font-medium">
        <button
          @click="subFilter = 'all'"
          class="flex-1 py-1 rounded-md text-center transition"
          :class="subFilter === 'all' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'"
        >
          全部 ({{ totalCount }})
        </button>
        <button
          @click="subFilter = 'unread'"
          class="flex-1 py-1 rounded-md text-center transition"
          :class="subFilter === 'unread' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'"
        >
          未读 ({{ unreadCount }})
        </button>
        <button
          @click="subFilter = 'code'"
          class="flex-1 py-1 rounded-md text-center transition flex items-center justify-center space-x-1"
          :class="subFilter === 'code' ? 'bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'"
        >
          <span>⚡ 验证码</span>
          <span v-if="codeCount > 0" class="text-[10px] px-1 bg-blue-100 dark:bg-blue-900/60 rounded">
            {{ codeCount }}
          </span>
        </button>
      </div>
    </div>

    <!-- 邮件卡片列表 -->
    <div class="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60">
      <div
        v-for="mail in filteredMails"
        :key="mail.id"
        @click="$emit('select', mail)"
        class="p-3 cursor-pointer transition select-none hover:bg-zinc-50 dark:hover:bg-zinc-900/80 group relative"
        :class="{
          'bg-blue-50/50 dark:bg-blue-950/30 border-l-4 border-l-blue-600': selectedEmail?.id === mail.id,
          'font-medium': !mail.is_read
        }"
      >
        <div class="flex items-start justify-between gap-2 mb-1">
          <div class="flex items-center space-x-2 truncate">
            <!-- 未读蓝点 -->
            <span
              v-if="!mail.is_read"
              class="w-2 h-2 rounded-full bg-blue-600 shrink-0"
              title="未读"
            ></span>
            <span class="text-xs text-zinc-900 dark:text-zinc-100 truncate">
              {{ mail.sender_name || mail.sender_address }}
            </span>
          </div>
          <span class="text-[10px] text-zinc-400 shrink-0 whitespace-nowrap">
            {{ formatRelativeTime(mail.received_at) }}
          </span>
        </div>

        <!-- 主题 -->
        <div class="text-xs text-zinc-800 dark:text-zinc-200 mb-1 truncate leading-snug">
          {{ mail.subject || '(无主题)' }}
        </div>

        <!-- 纯文本摘要 -->
        <div class="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed mb-1.5">
          {{ mail.body_preview || '(无内容摘要)' }}
        </div>

        <!-- 底部元信息条：所属账号、垃圾邮件标签、验证码一键复制 -->
        <div class="flex items-center justify-between mt-2 pt-1.5 border-t border-zinc-100/80 dark:border-zinc-800/40">
          <div class="flex items-center space-x-1.5 truncate">
            <!-- 所属账号 Badge -->
            <span class="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 font-mono truncate max-w-[140px]">
              {{ mail.account_email }}
            </span>
            <span v-if="mail.is_junk" class="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-medium">
              垃圾箱
            </span>
          </div>

          <!-- 验证码微卡片 -->
          <div
            v-if="mail.extracted_code"
            @click.stop="quickCopy(mail.extracted_code, mail.id)"
            class="flex items-center space-x-1.5 px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/80 transition cursor-pointer shrink-0"
            :title="copiedId === mail.id ? '已复制！' : '点击直接复制验证码'"
          >
            <span class="text-[10px]">⚡</span>
            <span class="font-mono text-xs font-bold tracking-wider">{{ mail.extracted_code }}</span>
            <span class="text-[10px] opacity-70">{{ copiedId === mail.id ? '✔' : '复制' }}</span>
          </div>
        </div>
      </div>

      <!-- 空白占位 -->
      <div v-if="filteredMails.length === 0" class="p-8 text-center text-xs text-zinc-400 space-y-2">
        <svg class="w-8 h-8 mx-auto opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
        </svg>
        <div>暂无匹配邮件</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { StoredEmail } from '../../db';

const props = defineProps<{
  emails: StoredEmail[];
  selectedEmail: StoredEmail | null;
  isRefreshing?: boolean;
}>();

defineEmits<{
  (e: 'select', email: StoredEmail): void;
  (e: 'refresh-current'): void;
}>();

const searchQuery = ref('');
const subFilter = ref<'all' | 'unread' | 'code'>('all');
const copiedId = ref<string | null>(null);

const totalCount = computed(() => props.emails.length);
const unreadCount = computed(() => props.emails.filter(e => !e.is_read).length);
const codeCount = computed(() => props.emails.filter(e => Boolean(e.extracted_code)).length);

const filteredMails = computed(() => {
  let list = props.emails;

  // 1. Tab 过滤
  if (subFilter.value === 'unread') {
    list = list.filter(e => !e.is_read);
  } else if (subFilter.value === 'code') {
    list = list.filter(e => Boolean(e.extracted_code));
  }

  // 2. 搜索过滤
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim();
    list = list.filter(e =>
      e.subject?.toLowerCase().includes(q) ||
      e.sender_name?.toLowerCase().includes(q) ||
      e.sender_address?.toLowerCase().includes(q) ||
      e.account_email?.toLowerCase().includes(q) ||
      e.extracted_code?.toLowerCase().includes(q) ||
      e.body_preview?.toLowerCase().includes(q)
    );
  }

  return list;
});

function quickCopy(code: string, id: string) {
  navigator.clipboard.writeText(code);
  copiedId.value = id;
  setTimeout(() => {
    if (copiedId.value === id) copiedId.value = null;
  }, 1500);
}

function formatRelativeTime(iso: string) {
  try {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return '刚刚';
    if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
    return new Date(iso).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
  } catch {
    return iso;
  }
}
</script>
