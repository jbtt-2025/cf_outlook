<template>
  <div
    v-if="show"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
  >
    <div
      class="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
    >
      <div class="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
        <h2 class="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center space-x-2">
          <span>🔑</span>
          <span>修改个人密码</span>
        </h2>
        <button
          @click="$emit('close')"
          class="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm"
        >
          ✕
        </button>
      </div>

      <form @submit.prevent="handleSubmit" class="p-6 space-y-4">
        <div v-if="error" class="px-3 py-2 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs">
          {{ error }}
        </div>

        <div class="space-y-1">
          <label class="block text-xs font-medium text-zinc-700 dark:text-zinc-300">原密码</label>
          <input
            v-model="oldPassword"
            type="password"
            required
            class="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div class="space-y-1">
          <label class="block text-xs font-medium text-zinc-700 dark:text-zinc-300">新密码 (至少 6 位)</label>
          <input
            v-model="newPassword"
            type="password"
            required
            class="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div class="space-y-1">
          <label class="block text-xs font-medium text-zinc-700 dark:text-zinc-300">确认新密码</label>
          <input
            v-model="confirmPassword"
            type="password"
            required
            class="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div class="flex items-center justify-end space-x-2 pt-2">
          <button
            type="button"
            @click="$emit('close')"
            class="px-3.5 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            取消
          </button>
          <button
            type="submit"
            :disabled="loading"
            class="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {{ loading ? '提交中...' : '确认修改' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { api } from '../../services/apiClient';

defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'success'): void;
}>();

const oldPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const error = ref('');
const loading = ref(false);

async function handleSubmit() {
  error.value = '';
  if (newPassword.value !== confirmPassword.value) {
    error.value = '两次输入的新密码不一致';
    return;
  }
  if (newPassword.value.length < 6) {
    error.value = '新密码长度至少需要 6 位';
    return;
  }

  loading.value = true;
  try {
    await api.post('/api/auth/change-password', {
      old_password: oldPassword.value,
      new_password: newPassword.value,
    });
    oldPassword.value = '';
    newPassword.value = '';
    confirmPassword.value = '';
    emit('success');
    emit('close');
  } catch (err: any) {
    error.value = err.message || '修改失败';
  } finally {
    loading.value = false;
  }
}
</script>
