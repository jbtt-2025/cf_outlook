<template>
  <div
    v-if="show"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
  >
    <div
      class="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden"
    >
      <!-- 头部 -->
      <div class="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50 shrink-0">
        <div class="flex items-center space-x-2.5">
          <span class="text-xl">🛡️</span>
          <div>
            <h2 class="text-base font-bold text-zinc-900 dark:text-zinc-100">
              用户管理
            </h2>
            <p class="text-xs text-zinc-500 dark:text-zinc-400">
              查看并管理系统用户及权限
            </p>
          </div>
        </div>

        <button
          @click="$emit('close')"
          class="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
        >
          ✕
        </button>
      </div>

      <!-- 提示气泡 -->
      <div v-if="toastMsg" class="px-6 py-2 bg-blue-50 dark:bg-blue-950/60 border-b border-blue-200 dark:border-blue-900 text-xs text-blue-700 dark:text-blue-300 flex items-center justify-between">
        <span>{{ toastMsg }}</span>
        <button @click="toastMsg = ''" class="hover:underline text-[11px]">关闭</button>
      </div>

      <!-- 用户列表表格 -->
      <div class="flex-1 overflow-auto p-6">
        <div v-if="loading" class="py-12 text-center text-xs text-zinc-400">
          加载用户数据中...
        </div>

        <div v-else class="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80 text-zinc-600 dark:text-zinc-400 font-medium">
                <th class="py-3 px-4">用户名</th>
                <th class="py-3 px-3">角色</th>
                <th class="py-3 px-3">状态</th>
                <th class="py-3 px-3">Outlook 邮箱数</th>
                <th class="py-3 px-3">注册时间</th>
                <th class="py-3 px-3">最后登录</th>
                <th class="py-3 px-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              <tr
                v-for="u in users"
                :key="u.id"
                class="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition"
              >
                <!-- 用户名 -->
                <td class="py-3 px-4 font-medium text-zinc-900 dark:text-zinc-100 flex items-center space-x-1.5">
                  <span>{{ u.username }}</span>
                  <span
                    v-if="u.id === currentUserId"
                    class="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-normal"
                  >
                    当前账号
                  </span>
                </td>

                <!-- 角色 -->
                <td class="py-3 px-3">
                  <span
                    v-if="u.role === 'admin'"
                    class="px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300"
                  >
                    管理员
                  </span>
                  <span
                    v-else
                    class="px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                  >
                    普通用户
                  </span>
                </td>

                <!-- 状态 -->
                <td class="py-3 px-3">
                  <span
                    v-if="u.status === 'active'"
                    class="inline-flex items-center space-x-1 text-emerald-600 dark:text-emerald-400"
                  >
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span>正常</span>
                  </span>
                  <span
                    v-else
                    class="inline-flex items-center space-x-1 text-rose-600 dark:text-rose-400"
                  >
                    <span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                    <span>已停用</span>
                  </span>
                </td>

                <!-- 邮箱资产数 -->
                <td class="py-3 px-3 font-mono font-medium text-zinc-700 dark:text-zinc-300">
                  {{ u.account_count || 0 }}
                </td>

                <!-- 注册时间 -->
                <td class="py-3 px-3 text-zinc-500">
                  {{ formatDate(u.created_at) }}
                </td>

                <!-- 最后登录 -->
                <td class="py-3 px-3 text-zinc-500">
                  {{ u.last_login_at ? formatDate(u.last_login_at) : '从未登录' }}
                </td>

                <!-- 操作按钮 -->
                <td class="py-3 px-4 text-right space-x-1.5">
                  <!-- 角色切换 -->
                  <button
                    v-if="u.id !== currentUserId"
                    @click="handleToggleRole(u)"
                    class="px-2 py-1 rounded text-[11px] font-medium border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition text-zinc-700 dark:text-zinc-300"
                  >
                    {{ u.role === 'admin' ? '降为用户' : '设为管理' }}
                  </button>

                  <!-- 启停状态 -->
                  <button
                    v-if="u.id !== currentUserId"
                    @click="handleToggleStatus(u)"
                    class="px-2 py-1 rounded text-[11px] font-medium border transition"
                    :class="u.status === 'active' ? 'border-rose-200 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40' : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'"
                  >
                    {{ u.status === 'active' ? '停用' : '启用' }}
                  </button>

                  <!-- 重置密码 -->
                  <button
                    @click="openResetPassword(u)"
                    class="px-2 py-1 rounded text-[11px] font-medium border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition text-zinc-700 dark:text-zinc-300"
                  >
                    重置密码
                  </button>

                  <!-- 删除用户 -->
                  <button
                    v-if="u.id !== currentUserId"
                    @click="handleDeleteUser(u)"
                    class="px-2 py-1 rounded text-[11px] font-medium border border-rose-200 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                  >
                    删除
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 底部关闭栏 -->
      <div class="px-6 py-3 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex justify-between items-center text-xs text-zinc-500 shrink-0">
        <span>共 {{ users.length }} 名注册用户</span>
        <button
          @click="$emit('close')"
          class="px-4 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-medium transition"
        >
          关闭
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { api } from '../../services/apiClient';

const props = defineProps<{
  show: boolean;
  currentUserId: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const users = ref<any[]>([]);
const loading = ref(false);
const toastMsg = ref('');

function formatDate(timestamp: number) {
  if (!timestamp) return '-';
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

async function loadUsers() {
  loading.value = true;
  try {
    const res = await api.get('/api/admin/users');
    if (res.success) {
      users.value = res.users || [];
    }
  } catch (err: any) {
    toastMsg.value = `加载用户失败: ${err.message}`;
  } finally {
    loading.value = false;
  }
}

async function handleToggleRole(user: any) {
  const newRole = user.role === 'admin' ? 'user' : 'admin';
  if (!confirm(`确定将用户 "${user.username}" 的角色更改为【${newRole === 'admin' ? '管理员' : '普通用户'}】吗？`)) {
    return;
  }
  try {
    await api.put(`/api/admin/users/${user.id}`, { role: newRole });
    toastMsg.value = `用户 "${user.username}" 角色已更新为 ${newRole}`;
    await loadUsers();
  } catch (err: any) {
    alert(err.message || '操作失败');
  }
}

async function handleToggleStatus(user: any) {
  const newStatus = user.status === 'active' ? 'disabled' : 'active';
  const actionText = newStatus === 'active' ? '启用' : '停用';
  if (!confirm(`确定${actionText}用户 "${user.username}" 吗？停用后该用户将无法登录系统。`)) {
    return;
  }
  try {
    await api.put(`/api/admin/users/${user.id}`, { status: newStatus });
    toastMsg.value = `用户 "${user.username}" 已${actionText}`;
    await loadUsers();
  } catch (err: any) {
    alert(err.message || '操作失败');
  }
}

async function openResetPassword(user: any) {
  const newPass = prompt(`请输入为用户 "${user.username}" 设置的新密码（至少 6 位）：`);
  if (!newPass) return;
  if (newPass.length < 6) {
    alert('密码长度至少需要 6 位');
    return;
  }
  try {
    await api.post(`/api/admin/users/${user.id}/reset-password`, { new_password: newPass });
    alert(`用户 "${user.username}" 密码已重置成功！`);
  } catch (err: any) {
    alert(err.message || '重置失败');
  }
}

async function handleDeleteUser(user: any) {
  if (!confirm(`确定要彻底删除用户 "${user.username}" 吗？\n该用户名下的所有邮箱数据及邮件记录将被一并删除，且无法恢复。`)) {
    return;
  }
  try {
    await api.delete(`/api/admin/users/${user.id}`);
    toastMsg.value = `用户 "${user.username}" 已被删除`;
    await loadUsers();
  } catch (err: any) {
    alert(err.message || '删除失败');
  }
}

watch(() => props.show, (newVal) => {
  if (newVal) {
    loadUsers();
  }
});

onMounted(() => {
  if (props.show) {
    loadUsers();
  }
});
</script>
