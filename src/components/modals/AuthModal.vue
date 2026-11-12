<template>
  <div
    v-if="show"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
  >
    <div
      class="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
    >
      <!-- 头部装饰与标题 -->
      <div class="px-6 pt-6 pb-4 border-b border-zinc-100 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-900/50">
        <div class="flex items-center space-x-2.5">
          <span class="text-2xl">⚡</span>
          <div>
            <h2 class="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              {{ hasAdmin ? (activeTab === 'login' ? '用户登录' : '新用户注册') : '系统初始化向导' }}
            </h2>
            <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {{ hasAdmin ? '登录您的工作台账号' : '请创建系统的管理员账号' }}
            </p>
          </div>
        </div>

        <!-- D1 未绑定警告 Banner -->
        <div
          v-if="dbNotReady && !checkingStatus"
          class="mt-3.5 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200 text-xs space-y-1"
        >
          <div class="flex items-center space-x-1.5 font-bold">
            <span>⚠️</span>
            <span>未检测到 Cloudflare D1 数据库绑定</span>
          </div>
          <p class="text-[11px] leading-relaxed opacity-90">
            请前往 Cloudflare Pages 后台 <b>【设置】->【函数】->【D1 数据库绑定】</b> 添加名为 <b><code>DB</code></b> 的绑定，保存后重新部署一次即可。
          </p>
        </div>

        <!-- 首任管理员提示条 -->
        <div
          v-if="!hasAdmin && !checkingStatus && !dbNotReady"
          class="mt-3.5 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300 text-xs flex items-center space-x-2"
        >
          <span>🚀</span>
          <span>首次使用：首位注册的用户将作为系统管理员。</span>
        </div>

        <!-- 选项卡切换 (当系统已有管理员时可用) -->
        <div v-if="hasAdmin" class="flex mt-4 p-1 rounded-xl bg-zinc-200/60 dark:bg-zinc-800/60 text-xs font-medium">
          <button
            type="button"
            @click="switchTab('login')"
            class="flex-1 py-1.5 rounded-lg transition-all duration-150"
            :class="activeTab === 'login' ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm font-semibold' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'"
          >
            登录
          </button>
          <button
            type="button"
            @click="switchTab('register')"
            class="flex-1 py-1.5 rounded-lg transition-all duration-150"
            :class="activeTab === 'register' ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm font-semibold' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'"
          >
            注册新用户
          </button>
        </div>
      </div>

      <!-- 表单主体 -->
      <form @submit.prevent="handleSubmit" class="p-6 space-y-4">
        <!-- 错误提示 Banner -->
        <div
          v-if="errorMessage"
          class="px-3.5 py-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs flex items-center space-x-2"
        >
          <span>⚠️</span>
          <span>{{ errorMessage }}</span>
        </div>

        <!-- 用户名 -->
        <div class="space-y-1.5">
          <label class="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            用户名 <span class="text-rose-500">*</span>
          </label>
          <input
            v-model="form.username"
            type="text"
            required
            autocomplete="username"
            placeholder="输入 3-32 位英文字母或数字"
            class="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
        </div>

        <!-- 密码 -->
        <div class="space-y-1.5">
          <label class="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            密码 <span class="text-rose-500">*</span>
          </label>
          <input
            v-model="form.password"
            type="password"
            required
            autocomplete="current-password"
            placeholder="至少 6 位字符"
            class="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
        </div>

        <!-- 确认密码 (仅注册) -->
        <div v-if="activeTab === 'register'" class="space-y-1.5">
          <label class="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            确认密码 <span class="text-rose-500">*</span>
          </label>
          <input
            v-model="form.confirmPassword"
            type="password"
            required
            autocomplete="new-password"
            placeholder="再次输入相同密码"
            class="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
        </div>

        <!-- 动态验证码 -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <label class="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              验证码 <span class="text-rose-500">*</span>
            </label>
            <button
              type="button"
              @click="fetchCaptcha"
              class="text-[11px] text-zinc-400 hover:text-blue-500 dark:hover:text-blue-400 transition"
            >
              看不清？换一张
            </button>
          </div>

          <div class="flex items-center space-x-2.5">
            <input
              v-model="form.captchaCode"
              type="text"
              required
              maxlength="6"
              placeholder="4 位验证码"
              class="w-32 px-3 py-2 text-sm font-mono tracking-wider uppercase rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />

            <!-- 验证码图片与点击刷新 -->
            <div
              @click="fetchCaptcha"
              class="cursor-pointer border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden shrink-0 hover:opacity-85 transition relative group"
              title="看不清？点击换一张"
            >
              <div v-if="captchaSvg" v-html="captchaSvg" class="flex items-center justify-center"></div>
              <div v-else class="w-[120px] h-[40px] flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-[11px] text-zinc-400">
                加载中...
              </div>
              <div class="absolute inset-0 bg-black/10 dark:bg-white/10 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-[10px] text-zinc-700 dark:text-zinc-200 font-medium bg-zinc-100/70 backdrop-blur-[1px]">
                点击刷新
              </div>
            </div>
          </div>
        </div>

        <!-- 提交按钮 -->
        <div class="pt-2">
          <button
            type="submit"
            :disabled="loading"
            class="w-full py-2.5 px-4 rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition shadow-sm"
          >
            <span v-if="loading">处理中...</span>
            <span v-else>{{ hasAdmin ? (activeTab === 'login' ? '立即登录' : '立即注册') : '创建管理员账号' }}</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { api, setStoredToken } from '../../services/apiClient';

defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  (e: 'login-success', user: any): void;
}>();

const activeTab = ref<'login' | 'register'>('login');
const hasAdmin = ref(true);
const dbNotReady = ref(false);
const checkingStatus = ref(true);
const loading = ref(false);
const errorMessage = ref('');
const captchaSvg = ref('');
const captchaId = ref('');

const form = reactive({
  username: '',
  password: '',
  confirmPassword: '',
  captchaCode: '',
});

function switchTab(tab: 'login' | 'register') {
  activeTab.value = tab;
  errorMessage.value = '';
  form.captchaCode = '';
  fetchCaptcha();
}

async function checkSystemStatus() {
  checkingStatus.value = true;
  try {
    const res = await api.get('/api/auth/status');
    hasAdmin.value = Boolean(res.has_admin);
    dbNotReady.value = res.db_ready === false;
    if (!hasAdmin.value) {
      activeTab.value = 'register';
    }
  } catch (e) {
    console.error('Check status error:', e);
  } finally {
    checkingStatus.value = false;
  }
}

async function fetchCaptcha() {
  try {
    const res = await api.get('/api/auth/captcha');
    if (res.success) {
      captchaSvg.value = res.svg;
      captchaId.value = res.captcha_id;
    }
  } catch (e: any) {
    console.error('Fetch captcha error:', e);
  }
}

async function handleSubmit() {
  errorMessage.value = '';

  if (activeTab.value === 'register' && form.password !== form.confirmPassword) {
    errorMessage.value = '两次输入的密码不一致';
    return;
  }

  loading.value = true;
  try {
    const endpoint = activeTab.value === 'login' ? '/api/auth/login' : '/api/auth/register';
    const payload = {
      username: form.username.trim(),
      password: form.password,
      captcha_id: captchaId.value,
      captcha_code: form.captchaCode.trim(),
    };

    const res = await api.post(endpoint, payload);

    if (res.success && res.token) {
      setStoredToken(res.token);
      emit('login-success', res.user);
    }
  } catch (err: any) {
    errorMessage.value = err.message || '请求失败，请稍后重试';
    // 失败后立即刷新验证码防穷举
    form.captchaCode = '';
    await fetchCaptcha();
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await checkSystemStatus();
  await fetchCaptcha();
});
</script>
