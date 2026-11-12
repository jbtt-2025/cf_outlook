<template>
  <div class="flex flex-col h-full bg-zinc-50/50 dark:bg-zinc-900/40 border-r border-zinc-200 dark:border-zinc-800">
    <!-- 主导航菜单项 -->
    <div class="p-3 space-y-1">
      <button
        @click="$emit('update:activeFolder', 'inbox')"
        class="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition"
        :class="activeFolder === 'inbox' ? 'bg-zinc-200/80 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'"
      >
        <div class="flex items-center space-x-2.5">
          <svg class="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
          </svg>
          <span>收件箱</span>
        </div>
        <span v-if="unreadCount > 0" class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white">
          {{ unreadCount }}
        </span>
      </button>

      <button
        @click="$emit('update:activeFolder', 'code_radar')"
        class="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition"
        :class="activeFolder === 'code_radar' ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50 shadow-sm' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'"
      >
        <div class="flex items-center space-x-2.5">
          <span class="text-sm">⚡</span>
          <span class="font-semibold">验证码雷达</span>
        </div>
        <span v-if="codeCount > 0" class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/80 dark:text-blue-300">
          {{ codeCount }} 条
        </span>
      </button>

      <button
        @click="$emit('update:activeFolder', 'junk')"
        class="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition"
        :class="activeFolder === 'junk' ? 'bg-zinc-200/80 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'"
      >
        <div class="flex items-center space-x-2.5">
          <svg class="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
          </svg>
          <span>垃圾邮件 (Junk)</span>
        </div>
        <span v-if="junkCount > 0" class="text-[11px] text-zinc-400 font-mono">
          {{ junkCount }}
        </span>
      </button>

      <button
        @click="$emit('update:activeFolder', 'accounts')"
        class="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition"
        :class="activeFolder === 'accounts' ? 'bg-zinc-200/80 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'"
      >
        <div class="flex items-center space-x-2.5">
          <svg class="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path>
          </svg>
          <span>账号资产管理</span>
        </div>
        <span class="text-[11px] text-zinc-400 font-mono">
          {{ accounts.length }}
        </span>
      </button>
    </div>

    <!-- 资产体检状态概览 -->
    <div class="mx-3 my-2 p-3 bg-white dark:bg-zinc-950/70 border border-zinc-200/80 dark:border-zinc-800 rounded-lg space-y-2">
      <div class="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
        <span>资产健康看板</span>
        <span v-if="runningJobs > 0" class="text-blue-500 text-[10px] animate-pulse">
          {{ runningJobs }} 并发运行中
        </span>
      </div>
      <div class="grid grid-cols-2 gap-2 text-xs">
        <div class="p-2 bg-emerald-50/60 dark:bg-emerald-950/30 rounded border border-emerald-100 dark:border-emerald-900/40">
          <div class="text-emerald-700 dark:text-emerald-400 text-xs font-medium">有效正常</div>
          <div class="text-base font-bold text-emerald-800 dark:text-emerald-300 font-mono">{{ activeCount }}</div>
        </div>
        <div class="p-2 bg-rose-50/60 dark:bg-rose-950/30 rounded border border-rose-100 dark:border-rose-900/40">
          <div class="text-rose-700 dark:text-rose-400 text-xs font-medium">失效死号</div>
          <div class="text-base font-bold text-rose-800 dark:text-rose-300 font-mono">{{ deadCount }}</div>
        </div>
      </div>
      <div class="flex items-center justify-between text-[11px] text-zinc-500 pt-1">
        <span>限流冷却: <b class="text-orange-500">{{ rateLimitedCount }}</b></span>
        <span>空箱待命: <b class="text-zinc-600 dark:text-zinc-400">{{ emptyCount }}</b></span>
      </div>
    </div>

    <!-- 轮询调度控制器 -->
    <div class="mx-3 mb-2 p-3 bg-white dark:bg-zinc-950/70 border border-zinc-200/80 dark:border-zinc-800 rounded-lg space-y-2.5">
      <div class="flex items-center justify-between">
        <span class="text-xs font-medium text-zinc-700 dark:text-zinc-300">自动智能轮询</span>
        <button
          @click="$emit('toggle-polling')"
          class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
          :class="isPolling ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-zinc-700'"
        >
          <span
            class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
            :class="isPolling ? 'translate-x-4' : 'translate-x-0'"
          />
        </button>
      </div>

      <div class="flex items-center justify-between text-xs text-zinc-500">
        <span>并发调度池 ({{ concurrency }})</span>
        <input
          type="range"
          min="1"
          max="15"
          :value="concurrency"
          @input="$emit('update:concurrency', Number(($event.target as HTMLInputElement).value))"
          class="w-20 accent-blue-600 cursor-pointer"
        />
      </div>

      <!-- 自动拉取周期设置 (默认 180S，可手动修改) -->
      <div class="space-y-1.5 pt-1.5 border-t border-zinc-100 dark:border-zinc-800">
        <div class="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
          <span>拉取周期</span>
          <div class="flex items-center space-x-1">
            <input
              type="number"
              min="10"
              max="3600"
              step="10"
              :value="pollInterval"
              @change="$emit('update:pollInterval', Number(($event.target as HTMLInputElement).value))"
              class="w-16 px-1.5 py-0.5 text-right font-mono bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <span class="text-[11px] text-zinc-400">秒</span>
          </div>
        </div>

        <!-- 快捷预设按钮 -->
        <div class="flex items-center space-x-1">
          <button
            v-for="preset in [60, 180, 300, 600]"
            :key="preset"
            @click="$emit('update:pollInterval', preset)"
            class="flex-1 py-0.5 text-[10px] rounded border transition text-center font-mono"
            :class="pollInterval === preset ? 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-800 font-bold' : 'bg-zinc-50 dark:bg-zinc-800/80 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700/60 hover:bg-zinc-100 dark:hover:bg-zinc-700'"
            :title="`设置为 ${preset} 秒轮询`"
          >
            {{ preset }}s
          </button>
        </div>
      </div>
    </div>

    <!-- 弹性空白填充 -->
    <div class="flex-1"></div>

    <!-- 底部批量运维工具条 (PLAN.md 3.1) -->
    <div class="p-3 border-t border-zinc-200 dark:border-zinc-800 space-y-1.5 bg-zinc-100/50 dark:bg-zinc-950/50">
      <button
        @click="$emit('open-import')"
        class="w-full flex items-center justify-center space-x-1.5 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
      >
        <span>+</span>
        <span>批量导入凭证</span>
      </button>

      <button
        @click="$emit('check-all')"
        :disabled="runningJobs > 0"
        class="w-full flex items-center justify-center space-x-1.5 py-1.5 px-3 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-medium transition disabled:opacity-50"
      >
        <span>⚡</span>
        <span>{{ runningJobs > 0 ? `正在体检中 (${runningJobs})...` : '批量全量体检' }}</span>
      </button>

      <div class="grid grid-cols-2 gap-1.5">
        <button
          @click="$emit('purge-dead')"
          :disabled="deadCount === 0"
          class="py-1.5 px-2 bg-white dark:bg-zinc-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-zinc-200 dark:border-zinc-700 hover:border-rose-300 dark:hover:border-rose-900 rounded-lg text-xs font-medium transition disabled:opacity-40 text-center"
          title="物理删除所有标记为 dead 的账号"
        >
          🧹 清理失效
        </button>

        <button
          @click="$emit('open-export')"
          class="py-1.5 px-2 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-medium transition text-center"
          title="导出带有滚动最新 RT 的凭证文件"
        >
          💾 导出凭证
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { OutlookAccount } from '../../db';

const props = defineProps<{
  activeFolder: 'inbox' | 'code_radar' | 'junk' | 'accounts';
  accounts: OutlookAccount[];
  unreadCount: number;
  codeCount: number;
  junkCount: number;
  isPolling: boolean;
  concurrency: number;
  pollInterval: number; // 轮询周期（秒）
  runningJobs: number;
}>();

defineEmits<{
  (e: 'update:activeFolder', folder: 'inbox' | 'code_radar' | 'junk' | 'accounts'): void;
  (e: 'update:concurrency', val: number): void;
  (e: 'update:pollInterval', val: number): void;
  (e: 'toggle-polling'): void;
  (e: 'open-import'): void;
  (e: 'open-export'): void;
  (e: 'check-all'): void;
  (e: 'purge-dead'): void;
}>();

const activeCount = computed(() => props.accounts.filter(a => a.status === 'active').length);
const deadCount = computed(() => props.accounts.filter(a => a.status === 'dead').length);
const emptyCount = computed(() => props.accounts.filter(a => a.status === 'empty').length);
const rateLimitedCount = computed(() => props.accounts.filter(a => a.status === 'rate_limited').length);
</script>
