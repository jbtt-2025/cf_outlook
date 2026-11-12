<template>
  <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
    <div class="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[90vh] overflow-hidden">
      <!-- 模态框头部 -->
      <div class="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <div>
          <h3 class="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span>📥</span> 批量导入 Outlook 凭证
          </h3>
          <p class="text-xs text-zinc-500 mt-0.5">支持粘贴多格式文本导入，凭证安全持久化在您的 Cloudflare D1 数据库中</p>
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
        <!-- 文本输入区 -->
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <label class="font-semibold text-zinc-700 dark:text-zinc-300">
              粘贴凭证文本（支持多行批量输入）：
            </label>
            <span class="text-zinc-400 font-mono">已解析 {{ parsedAccounts.length }} 个账号</span>
          </div>
          <textarea
            v-model="rawText"
            rows="7"
            placeholder="支持以下任意格式，每行一个账号：
email----refresh_token
email----password----refresh_token
email----password----client_id----refresh_token
或直接粘贴 JSON/JSONL/CSV 内容"
            class="w-full p-3 font-mono text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          ></textarea>
        </div>

        <!-- 选项配置网格 -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 bg-zinc-50 dark:bg-zinc-950/60 rounded-lg border border-zinc-200/80 dark:border-zinc-800">
          <!-- 重复处理策略 -->
          <div>
            <label class="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">遇到重复邮箱处理策略：</label>
            <select
              v-model="dedupStrategy"
              class="w-full p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md text-zinc-800 dark:text-zinc-200 focus:outline-none"
            >
              <option value="overwrite">覆盖更新 RT (推荐，保持最新凭据)</option>
              <option value="skip">跳过已存在邮箱</option>
              <option value="merge_tags">保留新凭据并合并标签</option>
            </select>
          </div>

          <!-- 默认 Client ID 设定 -->
          <div>
            <label class="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">默认绑定 Client ID：</label>
            <select
              v-model="selectedClientId"
              class="w-full p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md text-zinc-800 dark:text-zinc-200 focus:outline-none"
            >
              <option value="9e5f94bc-e8a4-4e73-b8be-63364c29d753">Microsoft Auth Broker (首选公共)</option>
              <option value="d3590ed6-52b3-4102-aeff-aad2292ab01c">Microsoft Office</option>
              <option value="27922004-5251-4030-b22d-91ecd9a37ea4">Outlook</option>
              <option value="000000004FD94165">Outlook Mobile</option>
              <option value="aebc6443-996d-45c2-90f0-388ff96faa56">VS Code</option>
            </select>
          </div>

          <!-- 分组标签 -->
          <div class="sm:col-span-2">
            <label class="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">可选分类标签（逗号分隔）：</label>
            <input
              v-model="tagsInput"
              type="text"
              placeholder="例如: openai, 批次01, 2026Q1"
              class="w-full p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md text-zinc-800 dark:text-zinc-200 focus:outline-none"
            />
          </div>
        </div>

        <!-- 实时解析预览表格 -->
        <div v-if="parsedAccounts.length > 0" class="space-y-1.5">
          <div class="font-medium text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
            <span>解析预览 (前 5 条)：</span>
            <span class="text-emerald-600 dark:text-emerald-400">格式有效</span>
          </div>
          <div class="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden max-h-36 overflow-y-auto font-mono text-[11px]">
            <table class="w-full text-left divide-y divide-zinc-200 dark:divide-zinc-800">
              <thead class="bg-zinc-100 dark:bg-zinc-800/80 text-zinc-500">
                <tr>
                  <th class="p-2">#</th>
                  <th class="p-2">邮箱账号</th>
                  <th class="p-2">密码</th>
                  <th class="p-2">Refresh Token 预览</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-zinc-100 dark:divide-zinc-800/60 bg-white dark:bg-zinc-900">
                <tr v-for="(item, idx) in parsedAccounts.slice(0, 5)" :key="idx">
                  <td class="p-2 text-zinc-400">{{ idx + 1 }}</td>
                  <td class="p-2 font-semibold text-zinc-800 dark:text-zinc-200">{{ item.email }}</td>
                  <td class="p-2 text-zinc-400">{{ item.password ? '••••••' : '(无)' }}</td>
                  <td class="p-2 text-zinc-500 truncate max-w-xs">{{ item.refresh_token.slice(0, 18) }}...</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- 模态框底部按钮 -->
      <div class="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 flex items-center justify-end space-x-3">
        <button
          @click="$emit('close')"
          class="px-4 py-2 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-xs font-medium transition"
        >
          取消
        </button>
        <button
          @click="submitImport"
          :disabled="parsedAccounts.length === 0"
          class="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50"
        >
          确认导入 ({{ parsedAccounts.length }} 个账号)
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { db, type OutlookAccount } from '../../db';
import { getStoredToken, api } from '../../services/apiClient';

const props = defineProps<{ show: boolean }>();
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'imported', count: number): void;
}>();

const rawText = ref('');
const dedupStrategy = ref<'overwrite' | 'skip' | 'merge_tags'>('overwrite');
const selectedClientId = ref('9e5f94bc-e8a4-4e73-b8be-63364c29d753');
const tagsInput = ref('');

interface ParsedItem {
  email: string;
  password?: string;
  client_id?: string;
  refresh_token: string;
}

const parsedAccounts = computed<ParsedItem[]>(() => {
  const text = rawText.value.trim();
  if (!text) return [];

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const result: ParsedItem[] = [];

  // 尝试判断是否为整个 JSON 数组
  if (text.startsWith('[') && text.endsWith(']')) {
    try {
      const arr = JSON.parse(text);
      if (Array.isArray(arr)) {
        for (const item of arr) {
          const email = item.email || item.account || item.mail;
          const rt = item.refresh_token || item.rt || item.refreshToken;
          if (email && rt) {
            result.push({
              email: String(email).trim().toLowerCase(),
              password: item.password ? String(item.password).trim() : undefined,
              client_id: item.client_id || selectedClientId.value,
              refresh_token: String(rt).trim(),
            });
          }
        }
        if (result.length > 0) return result;
      }
    } catch {
      // 不是普通 JSON，继续往下按行解析
    }
  }

  for (const line of lines) {
    // 1. JSON Lines (JSONL)
    if (line.startsWith('{') && line.endsWith('}')) {
      try {
        const obj = JSON.parse(line);
        const email = obj.email || obj.account || obj.mail;
        const rt = obj.refresh_token || obj.rt || obj.refreshToken;
        if (email && rt) {
          result.push({
            email: String(email).trim().toLowerCase(),
            password: obj.password ? String(obj.password).trim() : undefined,
            client_id: obj.client_id || selectedClientId.value,
            refresh_token: String(rt).trim(),
          });
          continue;
        }
      } catch {
        // 继续按分隔符解析
      }
    }

    // 2. 分隔符解析（支持 ----, ---, :, ,, \t, |）
    let parts: string[] = [];
    if (line.includes('----')) {
      parts = line.split('----');
    } else if (line.includes('---')) {
      parts = line.split('---');
    } else if (line.includes('|')) {
      parts = line.split('|');
    } else if (line.includes('\t')) {
      parts = line.split('\t');
    } else if (line.includes(',')) {
      parts = line.split(',');
    } else if (line.includes(':') && line.indexOf('@') < line.indexOf(':')) {
      parts = line.split(':');
    }

    parts = parts.map(p => p.trim());

    if (parts.length >= 2) {
      // 邮箱通常包含 @
      const emailCandidate = parts[0];
      if (emailCandidate.includes('@')) {
        let email = emailCandidate.toLowerCase();
        let password: string | undefined = undefined;
        let clientId: string | undefined = selectedClientId.value;
        let rt = '';

        if (parts.length === 2) {
          // email----rt
          rt = parts[1];
        } else if (parts.length === 3) {
          // email----pwd----rt
          password = parts[1];
          rt = parts[2];
        } else if (parts.length >= 4) {
          // email----pwd----client_id----rt
          password = parts[1];
          clientId = parts[2] || selectedClientId.value;
          rt = parts[3];
        }

        if (rt.length > 10) {
          result.push({
            email,
            password,
            client_id: clientId,
            refresh_token: rt,
          });
        }
      }
    }
  }

  return result;
});

async function submitImport() {
  const items = parsedAccounts.value;
  if (items.length === 0) return;

  const extraTags = tagsInput.value
    .split(/[,，]/)
    .map(t => t.trim())
    .filter(Boolean);

  let importedCount = 0;
  const now = Date.now();

  for (const item of items) {
    const existing = await db.accounts.get(item.email);

    if (existing) {
      if (dedupStrategy.value === 'skip') {
        continue;
      }

      const mergedTags = Array.from(new Set([...(existing.tags || []), ...extraTags]));
      const updateData: Partial<OutlookAccount> = {
        refresh_token: item.refresh_token,
        client_id: item.client_id || existing.client_id,
        status: 'idle',
        dead_reason: undefined,
        tags: dedupStrategy.value === 'merge_tags' ? mergedTags : (extraTags.length ? extraTags : existing.tags),
      };

      if (item.password) {
        updateData.password = item.password;
      }

      await db.accounts.update(existing.id, updateData);
      importedCount++;
    } else {
      const newAccount: OutlookAccount = {
        id: item.email,
        email: item.email,
        password: item.password,
        refresh_token: item.refresh_token,
        client_id: item.client_id || selectedClientId.value,
        status: 'idle',
        tags: extraTags,
        created_at: now,
      };

      await db.accounts.add(newAccount);
      importedCount++;
    }
  }

  if (getStoredToken()) {
    try {
      await api.post('/api/accounts/import', {
        accounts: items.map(item => ({
          email: item.email,
          password: item.password,
          refresh_token: item.refresh_token,
          client_id: item.client_id || selectedClientId.value,
          tags: extraTags,
        })),
      });
    } catch (err) {
      console.error('Remote import failed:', err);
    }
  }

  rawText.value = '';
  tagsInput.value = '';
  emit('imported', importedCount);
  emit('close');
}
</script>
