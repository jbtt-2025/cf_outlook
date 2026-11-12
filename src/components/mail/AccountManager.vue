<template>
  <div class="flex flex-col h-full bg-white dark:bg-zinc-950">
    <!-- 头部工具栏 -->
    <div class="p-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <span>👥</span> 账号管理
        </h2>
        <p class="text-xs text-zinc-500 mt-0.5">
          共 {{ accounts.length }} 个账号 · 默认按最新导入时间排序
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
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
          class="px-3 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500 w-36 sm:w-44"
        />

        <!-- 排序方式选择 (默认：按导入时间最新优先) -->
        <select
          v-model="sortBy"
          class="px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-800 dark:text-zinc-200 focus:outline-none"
        >
          <option value="created_desc">按导入时间 (最新优先)</option>
          <option value="created_asc">按导入时间 (最早优先)</option>
          <option value="last_checked_desc">按最后同步时间</option>
          <option value="email_asc">按邮箱 (A-Z)</option>
          <option value="unread_desc">按未读数 (多到少)</option>
        </select>

        <!-- 状态过滤 -->
        <select
          v-model="statusFilter"
          class="px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-800 dark:text-zinc-200 focus:outline-none"
        >
          <option value="all">全部状态</option>
          <option value="active">正常活跃</option>
          <option value="empty">空箱</option>
          <option value="dead">已失效</option>
          <option value="rate_limited">限流 (429)</option>
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
            <th class="py-2.5 px-4 font-semibold">导入时间</th>
            <th class="py-2.5 px-4 font-semibold">最后同步时间</th>
            <th class="py-2.5 px-4 font-semibold">Client ID</th>
            <th class="py-2.5 px-4 font-semibold">标签与注释</th>
            <th class="py-2.5 px-4 font-semibold text-right">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-zinc-100 dark:divide-zinc-800/60 text-zinc-800 dark:text-zinc-200">
          <tr
            v-for="acc in paginatedList"
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

            <!-- 导入时间 (优先管理) -->
            <td class="py-2.5 px-4 text-zinc-500 text-[11px] whitespace-nowrap font-mono" :title="acc.created_at ? new Date(acc.created_at).toLocaleString() : ''">
              {{ formatDateTime(acc.created_at) }}
            </td>

            <!-- 最后同步时间 -->
            <td class="py-2.5 px-4 text-zinc-500 text-[11px] whitespace-nowrap">
              {{ acc.last_checked_at ? new Date(acc.last_checked_at).toLocaleTimeString() : '未检测' }}
            </td>

            <!-- Client ID -->
            <td class="py-2.5 px-4 font-mono text-[11px] text-zinc-400 truncate max-w-[120px]" :title="acc.client_id">
              {{ acc.client_id ? acc.client_id.slice(0, 8) + '...' : '默认' }}
            </td>

            <!-- 标签与注释 (支持点击直接修改) -->
            <td class="py-2.5 px-4">
              <div class="flex flex-wrap items-center gap-1">
                <span
                  v-for="tag in acc.tags"
                  :key="tag"
                  class="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-900/60 text-blue-700 dark:text-blue-300 rounded text-[10px] font-medium"
                >
                  {{ tag }}
                </span>
                <!-- 修改/添加标签按钮 -->
                <button
                  @click.stop="openTagModal(acc)"
                  class="px-1.5 py-0.5 text-[10px] rounded text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition flex items-center gap-0.5"
                  title="修改此账号的标签注释"
                >
                  <span>🏷️</span>
                  <span>{{ (!acc.tags || acc.tags.length === 0) ? '+ 标签' : '修改' }}</span>
                </button>
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

    <!-- 底部分页控制工具栏 (针对 10,000 级海量账号秒级分页) -->
    <div
      v-if="filteredList.length > 0"
      class="px-4 py-2.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/60 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-600 dark:text-zinc-400 select-none"
    >
      <div class="flex items-center space-x-2">
        <span>
          共 <strong class="font-mono text-zinc-900 dark:text-zinc-100">{{ filteredList.length.toLocaleString() }}</strong> 个账号
        </span>
        <span class="text-zinc-300 dark:text-zinc-700">|</span>
        <span>
          第 <strong class="font-mono text-zinc-900 dark:text-zinc-100">{{ pageStart }} - {{ pageEnd }}</strong> 项
        </span>
      </div>

      <div class="flex items-center space-x-3">
        <!-- 每页条数选择 -->
        <div class="flex items-center space-x-1.5">
          <span>每页</span>
          <select
            v-model.number="pageSize"
            class="px-2 py-1 text-xs bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded text-zinc-800 dark:text-zinc-200 focus:outline-none"
          >
            <option :value="50">50 条</option>
            <option :value="100">100 条</option>
            <option :value="200">200 条</option>
            <option :value="500">500 条</option>
          </select>
        </div>

        <!-- 分页按钮 -->
        <div class="flex items-center space-x-1">
          <button
            @click="currentPage = 1"
            :disabled="currentPage <= 1"
            class="px-2 py-1 rounded bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 disabled:opacity-40 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition"
            title="首页"
          >
            «
          </button>
          <button
            @click="currentPage = Math.max(1, currentPage - 1)"
            :disabled="currentPage <= 1"
            class="px-2 py-1 rounded bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 disabled:opacity-40 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition"
            title="上一页"
          >
            ‹
          </button>

          <span class="px-2 py-1 font-mono text-xs text-zinc-800 dark:text-zinc-200">
            {{ currentPage }} / {{ totalPages }}
          </span>

          <button
            @click="currentPage = Math.min(totalPages, currentPage + 1)"
            :disabled="currentPage >= totalPages"
            class="px-2 py-1 rounded bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 disabled:opacity-40 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition"
            title="下一页"
          >
            ›
          </button>
          <button
            @click="currentPage = totalPages"
            :disabled="currentPage >= totalPages"
            class="px-2 py-1 rounded bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 disabled:opacity-40 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition"
            title="末页"
          >
            »
          </button>
        </div>

        <!-- 页码跳转 -->
        <div class="flex items-center space-x-1">
          <span>前往</span>
          <input
            type="number"
            min="1"
            :max="totalPages"
            v-model.lazy="jumpPageInput"
            @keydown.enter="handleJumpPage"
            class="w-12 px-1.5 py-1 text-center font-mono text-xs bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <span>页</span>
        </div>
      </div>
    </div>

    <!-- 标签修改弹窗 -->
    <div
      v-if="editingAccount"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div class="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden p-5 space-y-4">
        <div class="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <div class="flex items-center space-x-2">
            <span class="text-lg">🏷️</span>
            <div>
              <h3 class="text-sm font-bold text-zinc-900 dark:text-zinc-100">修改账号标签注释</h3>
              <p class="text-[11px] text-zinc-500 font-mono truncate max-w-xs">{{ editingAccount.email }}</p>
            </div>
          </div>
          <button @click="closeTagModal" class="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm">✕</button>
        </div>

        <!-- 标签 Chip 列表与添加 -->
        <div class="space-y-2">
          <label class="block text-xs font-medium text-zinc-700 dark:text-zinc-300">当前标签：</label>
          <div class="flex flex-wrap gap-1.5 min-h-[36px] p-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg">
            <span
              v-for="(t, idx) in tempTags"
              :key="idx"
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 text-xs font-medium"
            >
              <span>{{ t }}</span>
              <button
                type="button"
                @click="removeTag(idx)"
                class="text-blue-500 hover:text-blue-700 dark:hover:text-blue-200 ml-0.5 text-xs font-bold"
              >
                ×
              </button>
            </span>
            <span v-if="tempTags.length === 0" class="text-zinc-400 text-xs py-0.5">暂无标签</span>
          </div>
        </div>

        <!-- 输入新标签 -->
        <div class="space-y-1.5">
          <label class="block text-xs font-medium text-zinc-700 dark:text-zinc-300">添加新标签（按回车或输入逗号）：</label>
          <div class="flex gap-2">
            <input
              v-model="newTagInput"
              type="text"
              @keydown.enter.prevent="addTagFromInput"
              placeholder="输入标签名..."
              class="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="button"
              @click="addTagFromInput"
              class="px-3 py-1.5 text-xs bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg font-medium transition"
            >
              添加
            </button>
          </div>
        </div>

        <!-- 常用推荐预设标签 -->
        <div class="space-y-1">
          <div class="text-[11px] text-zinc-400">常用预设标签：</div>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="preset in ['测试', '主力', '备用', 'OpenAI', '批量01', '重要']"
              :key="preset"
              type="button"
              @click="addPresetTag(preset)"
              class="px-2 py-0.5 rounded text-[11px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950 dark:hover:text-blue-300 transition"
            >
              + {{ preset }}
            </button>
          </div>
        </div>

        <!-- 底部操作按钮 -->
        <div class="flex items-center justify-end space-x-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <button
            type="button"
            @click="closeTagModal"
            class="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            取消
          </button>
          <button
            type="button"
            @click="saveTags"
            :disabled="savingTags"
            class="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {{ savingTags ? '保存中...' : '保存修改' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { db, type OutlookAccount, type AccountStatus } from '../../db';
import { api, getStoredToken } from '../../services/apiClient';

const props = defineProps<{
  accounts: OutlookAccount[];
}>();

const emit = defineEmits<{
  (e: 'check-one', id: string): void;
  (e: 'delete', id: string): void;
  (e: 'tags-updated', data: { accountId: string; tags: string[] }): void;
}>();

const search = ref('');
const statusFilter = ref<string>('all');
const sortBy = ref<string>('created_desc'); // 默认按导入时间降序
const copiedEmail = ref<string | null>(null);
const batchCopied = ref(false);

// 分页状态管理 (针对 10,000 级数据极致流畅)
const pageSize = ref(100);
const currentPage = ref(1);
const jumpPageInput = ref(1);

// 标签编辑状态
const editingAccount = ref<OutlookAccount | null>(null);
const tempTags = ref<string[]>([]);
const newTagInput = ref('');
const savingTags = ref(false);

function openTagModal(acc: OutlookAccount) {
  editingAccount.value = acc;
  tempTags.value = [...(acc.tags || [])];
  newTagInput.value = '';
}

function closeTagModal() {
  editingAccount.value = null;
  tempTags.value = [];
  newTagInput.value = '';
}

function addTagFromInput() {
  const parts = newTagInput.value.split(/[,，]/).map(t => t.trim()).filter(Boolean);
  for (const p of parts) {
    if (!tempTags.value.includes(p)) {
      tempTags.value.push(p);
    }
  }
  newTagInput.value = '';
}

function addPresetTag(preset: string) {
  if (!tempTags.value.includes(preset)) {
    tempTags.value.push(preset);
  }
}

function removeTag(idx: number) {
  tempTags.value.splice(idx, 1);
}

async function saveTags() {
  if (!editingAccount.value) return;
  savingTags.value = true;
  const accountId = editingAccount.value.id;
  const newTagsList = Array.from(new Set(tempTags.value.map(t => t.trim()).filter(Boolean)));

  try {
    // 1. 更新本地 IndexedDB
    await db.accounts.update(accountId, { tags: newTagsList });

    // 2. 如果已登录，同步更新远端 D1 数据库
    if (getStoredToken()) {
      await api.put(`/api/accounts/${encodeURIComponent(accountId)}/tags`, {
        tags: newTagsList,
      });
    }

    // 3. 更新内存中对象引用
    editingAccount.value.tags = newTagsList;
    emit('tags-updated', { accountId, tags: newTagsList });
    closeTagModal();
  } catch (err: any) {
    alert(`保存标签失败: ${err?.message || err}`);
  } finally {
    savingTags.value = false;
  }
}

const filteredList = computed(() => {
  let list = [...props.accounts];

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

  // 排序：默认优先按导入时间 (created_at 降序)
  list.sort((a, b) => {
    switch (sortBy.value) {
      case 'created_asc':
        return (a.created_at || 0) - (b.created_at || 0);
      case 'last_checked_desc':
        return (b.last_checked_at || 0) - (a.last_checked_at || 0);
      case 'email_asc':
        return a.email.localeCompare(b.email);
      case 'unread_desc':
        return (b.unread_count || 0) - (a.unread_count || 0);
      case 'created_desc':
      default:
        return (b.created_at || 0) - (a.created_at || 0);
    }
  });

  return list;
});

// 分页计算 (DOM 节点仅渲染当前页 50-500 条，杜绝 10,000 条全量渲染导致的页面假死)
const totalPages = computed(() => Math.max(1, Math.ceil(filteredList.value.length / pageSize.value)));

const paginatedList = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredList.value.slice(start, start + pageSize.value);
});

const pageStart = computed(() => {
  if (filteredList.value.length === 0) return 0;
  return (currentPage.value - 1) * pageSize.value + 1;
});

const pageEnd = computed(() => {
  return Math.min(currentPage.value * pageSize.value, filteredList.value.length);
});

watch([search, statusFilter, sortBy, pageSize], () => {
  currentPage.value = 1;
  jumpPageInput.value = 1;
});

watch(currentPage, (val) => {
  jumpPageInput.value = val;
});

function handleJumpPage() {
  const p = parseInt(String(jumpPageInput.value), 10);
  if (!isNaN(p)) {
    currentPage.value = Math.max(1, Math.min(totalPages.value, p));
  }
}

function formatDateTime(ts?: number) {
  if (!ts) return '-';
  const d = new Date(ts);
  const Y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, '0');
  const D = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${Y}-${M}-${D} ${h}:${m}`;
}

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
    case 'refreshing': return '刷新中...';
    case 'dead': return '已失效';
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
