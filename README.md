<div align="center">

# ⚡ Outlook Graph 批量邮箱管理与邮件获取系统
### (Cloudflare Pages 全栈版 / Fullstack Monolithic)

> **多用户权限隔离 · 纯原生防穷举验证码 · 服务端凭据持久化 · 微软最新 RT 自动滚动回写**
> 
> 基于 **Cloudflare Pages 前后端不分离架构**，前端三栏邮件工作台与后端 `/functions` 边缘网关同源同域驱动。
> 支持管理员与普通用户角色权限隔离，内置服务端防穷举动态图形验证码，网页端自动轮询调度并实时写回最新有效 Refresh Token。

[![Cloudflare Pages](https://img.shields.io/badge/Deployed%20with-Cloudflare%20Pages-F38020?logo=cloudflare&logoColor=white)](https://cf-outlook.pages.dev)
[![Vue 3](https://img.shields.io/badge/Vue-3.5-4FC08D?logo=vuedotjs&logoColor=white)](https://vuejs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Playwright](https://img.shields.io/badge/Playwright-E2E%20Tested-2EAD33?logo=playwright&logoColor=white)](https://playwright.dev/)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)

🌐 **线上演示 Demo**：[https://cf-outlook.pages.dev](https://cf-outlook.pages.dev)

</div>

---

## 📖 目录

- [✨ 核心功能特性](#-核心功能特性)
- [☁️ Cloudflare Pages 线上部署方式](#️-cloudflare-pages-线上部署方式)
  - [方式一：直接上传 ZIP 压缩包部署（零门槛，最快捷，免命令行）](#方式一直接上传-zip-压缩包部署零门槛最快捷免命令行)
  - [方式二：Wrangler CLI 本地命令行一键部署（极客推荐，CI/CD 友好）](#方式二wrangler-cli-本地命令行一键部署极客推荐cicd-友好)
  - [方式三：Fork 本 GitHub 仓库连接 Pages 自动持续部署（推荐长期维护）](#方式三fork-本-github-仓库连接-pages-自动持续部署推荐长期维护)
- [🚀 本地开发与测试指南](#-本地开发与测试指南)
- [📁 完整代码库目录树](#-完整代码库目录树)
- [🔒 隐私与安全性声明](#-隐私与安全性声明)
- [📄 开源协议](#-开源协议)

---

## ✨ 核心功能特性

### 1. 👥 用户注册与多角色管控系统 (Admin & User)
- **极简极速注册**：仅需输入「用户名」与「密码」即可秒级完成注册与登录；
- **首任超级管理员自动提权**：数据库首次初始化时，首位注册用户自动提权为**超级管理员 (Admin)**；后续注册用户自动赋予**普通用户 (User)** 角色；
- **全生命周期管控面板**：管理员专属面板支持实时查看所有注册用户、一键切换用户角色（管理员/普通用户）、一键停用/启用用户、重置用户密码以及物理级删除用户资产；
- **严格的数据隔离**：每个用户的 Outlook 邮箱凭证与邮件数据物理隔离，普通用户仅能查看与操作自己名下的邮箱资产。

### 2. 🛡️ 纯原生 WebCrypto 防穷举动态验证码 (HMAC Captcha)
- **防脚本爆破与撞库**：在用户登录与注册环节内置防穷举矢量 SVG 动态验证码，字符带随机旋转、扰动贝塞尔曲线与噪点；
- **边缘无状态防篡改**：采用纯 WebCrypto 原生实现的 HMAC-SHA256 签名校验机制，零外部依赖，极速核验且防篡改；
- **交互友好**：轻触验证码图片即可一键动态刷新。

### 3. ⚡ 验证码雷达专属流 (Code Radar)
- **智能提取算法**：内置高精度多模式正则与 HTML 样式解析器，自动从邮件标题、正文及大号字体样式中提取 4~8 位数字或大写字母组合验证码（支持 Google、OpenAI、GitHub、Discord 等常见平台通知格式）；
- **防误判过滤**：内置停用词表，自动规避年份（如 2024~2035）及普通英语单词误判；
- **一键快捷复制**：雷达流中以高亮大卡片形式展示最新验证码，卡片与邮件列表中均内嵌一键复制按钮与动态复制反馈。

### 2. 🖥️ Shadcn Mail 现代三栏工作台
- **栏 1（导航与状态总览）**：
  - 账号切换下拉框（支持聚合收件箱 Unified Inbox 与单号隔离视图秒级切换）；
  - 收件箱、验证码雷达、垃圾邮件箱（Junk）、账号资产管理一键跳转；
  - 资产健康度实时看板（有效正常、失效死号、限流冷却、空箱待命统计）；
  - 自动轮询调度控制器与并发滑动条。
- **栏 2（邮件列表与即时检索）**：
  - 支持发件人、收件邮箱、主题及验证码全局模糊搜索；
  - 全部 (All) / 未读 (Unread) / 验证码雷达 (Code) 快速分类筛选；
  - 邮件卡片内嵌所属账号徽章、未读蓝点与验证码微卡片。
- **栏 3（安全沙箱阅读与报头分析）**：
  - **防 XSS 沙箱隔离**：正文使用 `DOMPurify` 消毒并在安全沙箱 `iframe` 中渲染，防止恶意样式攻击或追踪；
  - **纯文本视图**：提供清爽的代码级纯文本阅读模式；
  - **RFC822 原始报头分析器**：完整呈现 Internet Message Headers 表格并支持一键复制，方便排查反垃圾与投递路径。

### 3. 👥 账号全生命周期资产管理
- **一键复制邮箱**：表格行内直配 `📋` 复制图标，操作栏配备独立「复制邮箱」按钮，顶部工具栏提供「复制当前邮箱 (N)」一键导出当前筛选出的全部邮箱列表（以换行符分隔）；
- **单号即时拉取**：支持点击「同步」对任意单个邮箱发起即时 OAuth 刷新与邮件双箱检测；
- **复制最新 RT**：支持一键复制当前账号在本地已更新滚动到的最新 Refresh Token；
- **精准死号标识**：当微软返回 `AADSTS50173`、`AADSTS700082`、`invalid_grant` 等不可逆错误时，精准标红并在提示中展示具体失效原因。

### 4. 🔄 智能并发调度与防限流熔断引擎
- **可自定义轮询周期**：默认 **180 秒（180S）** 自动拉取周期，界面提供数值输入与 `60s` / `180s` / `300s` / `600s` 快捷预设，配置自动持久化至 `localStorage`；
- **并发控制池**：可灵活调节全局最大并发数（1~15，默认 5），避免浏览器连接拥塞；
- **自适应退避机制**：近期 5 分钟内收到验证码的活跃号进入 15 秒高频监听，连续空箱号自动降频，兼顾时效与资源消耗；
- **HTTP 429 熔断保护**：自动捕获微软 Graph API 限流响应并提取 `Retry-After`，进入倒计时挂起，冷却结束前自动跳过，避免账号或 IP 被微软风控。

### 5. 🔑 微软官方协议多端点轮换
- **预置公共 Client ID 轮换**：
  1. `9e5f94bc-e8a4-4e73-b8be-63364c29d753`（Microsoft Authentication Broker，默认首选）
  2. `d3590ed6-52b3-4102-aeff-aad2292ab01c`（Microsoft Office）
  3. `27922004-5251-4030-b22d-91ecd9a37ea4`（Outlook）
  4. `000000004FD94165`（Outlook Mobile）
  5. `aebc6443-996d-45c2-90f0-388ff96faa56`（VS Code）
- **多端点矩阵回退**：自动依次尝试 `login.microsoftonline.com/consumers/oauth2/v2.0/token`、`login.microsoftonline.com/common/oauth2/v2.0/token` 及 `login.live.com/oauth20_token.srf`。

### 6. 💾 滚动凭据导入导出
- **智能去重导入**：支持两段式 (`email----rt`)、四段式 (`email----pwd----client----rt`)、JSONL 及 CSV 多格式混贴；支持「覆盖更新 RT」、「跳过重复」、「合并标签」去重策略并提供前 5 条实时解析预览；
- **滚动 RT 导出**：支持导出全部账号、仅有效账号、仅失效账号；导出格式覆盖极简两段式、完整四段式、JSONL、CSV，**确保导出的 RT 100% 包含微软签发的最新未过期滚动凭据**。

---

## ☁️ Cloudflare Pages 线上部署指南 (含 D1 数据库配置)

由于本项目支持**多用户权限隔离**与**服务端凭证自动持久化**，部署时需在 Cloudflare 免费创建一个 D1 数据库并绑定至 Pages（完全免费，Cloudflare 提供每天 500 万次读取与 10 万次写入额度）。

### 📌 关键准备：创建 Cloudflare D1 数据库 (仅需 30 秒)

1. 登录 [Cloudflare 控制台 (Dashboard)](https://dash.cloudflare.com/)；
2. 在左侧菜单点击 **存储和数据库 (Storage & Databases)** -> 选择 **D1 SQL 数据库**；
3. 点击 **创建 (Create)** -> 输入数据库名称（例如：`cf-outlook-db`）-> 点击 **创建** 即可。

---

### 方式一：直接上传 ZIP 压缩包部署（零门槛，最快捷，免命令行）

> 适合无需任何本地开发环境、想要在 1 分钟内完成部署的用户。

1. **获取部署包**：
   - **途径 A（直接下载）**：从本项目 GitHub Releases 页面下载预打包好的最新 `dist.zip`；
   - **途径 B（本地打包）**：在本地项目目录下执行：
     ```bash
     npm run build:zip
     ```
     *(该脚本会自动打包静态资源并将 `functions/` 边缘 API 编译至 `dist/_worker.js`，最终生成 `dist.zip`)*。
2. **在 Cloudflare 部署 Pages**：
   - 登录 Cloudflare 控制台 -> 左侧菜单点击 **Workers 和 Pages (Workers & Pages)** -> 点击 **创建应用程序 (Create application)**；
   - 切换到 **Pages** 标签页 -> 选择 **直接上传 (Direct Upload)**；
   - 输入您自定义的项目名称（例如：`cf-outlook`）；
   - 将 `dist.zip` 压缩包直接拖拽上传到网页虚线框中；
   - 点击 **部署站点 (Deploy site)**。
3. **绑定 D1 数据库**：
   - 部署完成后，点击 **继续处理项目 (Continue to project)**（或进入该 Pages 项目主页）；
   - 切换到 **设置 (Settings)** 标签页 -> 点击左侧 **函数 (Functions)**；
   - 向下滚动找到 **D1 数据库绑定 (D1 database bindings)** -> 点击 **添加绑定 (Add binding)**：
     - **变量名称 (Variable name)**：必须填写 **`DB`**（严格大写）；
     - **D1 数据库 (D1 database)**：选择前面创建的 `cf-outlook-db`；
   - 点击 **保存 (Save)**。
4. **触发一次重新部署使绑定生效**：
   - 返回项目 **部署 (Deployments)** 页面，点击最近一次部署右侧的 `...` 菜单 -> 选择 **重试部署 (Retry deployment)**（或重新上传一次 `dist.zip`）；
5. **初始化并使用**：
   - 打开分配的 `https://<你的项目名>.pages.dev`；
   - 系统将自动弹出「系统初始化向导」，输入用户名、密码及验证码注册，**首位注册用户即为系统超级管理员**！

---

### 方式二：Wrangler CLI 本地命令行一键部署（极客推荐，CI/CD 友好）

> 适合拥有 Node.js 环境、希望在本地命令行直接部署与调试的开发者。

1. **配置环境变量与 D1 数据库**：
   - 运行命令行创建云端 D1 数据库：
     ```bash
     npx wrangler d1 create cf-outlook-db
     ```
     *(终端会输出 `database_name` 与 `database_id`)*。
   - 将根目录下的 `.env.example` 复制为 `.env` 并填写 Cloudflare 凭证。
2. **安装依赖并编译打包**：
   ```bash
   npm install
   npm run build:zip
   ```
3. **一键推送部署**：
   ```bash
   npx wrangler pages deploy dist --project-name=cf-outlook --branch=main
   ```
4. **绑定 D1 数据库**：
   - 在 Cloudflare 控制台进入部署好的 `cf-outlook` Pages 项目 -> **设置 (Settings)** -> **函数 (Functions)** -> **D1 数据库绑定** -> 添加绑定名 **`DB`** 指向 `cf-outlook-db`。

---

### 方式三：Fork 本 GitHub 仓库连接 Pages 自动持续部署（推荐长期维护）

> 适合希望通过 Git 提交全自动触发线上构建、持续跟进上游更新的团队与个人。

1. **Fork 仓库**：
   - 点击本 GitHub 仓库右上角的 **Fork** 按钮，将代码复制到你个人的 GitHub 账号下。
2. **连接到 Cloudflare Pages**：
   - 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)；
   - 导航至 **Workers 和 Pages** -> 点击 **创建应用程序** -> 选择 **Pages**；
   - 点击 **连接到 Git (Connect to Git)** 并授权绑定你的 GitHub 账号；
   - 从列表中选择刚刚 Fork 的仓库，点击 **开始设置 (Begin setup)**。
3. **填写构建配置 (Build Settings)**：
   - **框架预设 (Framework preset)**：选择 **`Vite`**；
   - **构建命令 (Build command)**：填入 `npm run build`；
   - **构建输出目录 (Build output directory)**：填入 `dist`。
4. **保存并自动发布**：
   - 点击 **保存并部署 (Save and Deploy)**。
5. **绑定 D1 数据库**：
   - 构建完成后，前往该 Pages 项目 -> **设置 (Settings)** -> **函数 (Functions)** -> **D1 数据库绑定** -> 添加变量名 **`DB`** 绑定至 `cf-outlook-db`；
   - 绑定后点击 **重试构建 (Retry deployment)** 即可完全上线！

---

## 🚀 本地开发与测试指南

### 1. 启动全栈本地开发服务
```bash
# 1. 安装项目依赖
npm install

# 2. 启动全栈开发环境
npm run dev
```
> 本地开发服务器运行在 `http://localhost:5173`。Vite 插件已内置全栈边缘 API 模拟层，无需启动任何外部代理即可调试完整的 Refresh Token 刷新与邮件拉取！

### 2. 运行自动化测试套件
```bash
# 运行验证码解析算法与死号标记单元测试
npm test

# 运行 Playwright 端到端全套自动化浏览器测试
npm run test:e2e

# 运行 TypeScript 强类型同构检查
npm run typecheck
```

---

## 📁 完整代码库目录树

```
cf_outlook/
├── functions/api/[[route]].ts      # 【全栈后端】Cloudflare Pages 边缘网关 (OAuth2 刷新 + Graph 邮件拉取)
├── public/_routes.json             # Pages 路由优化配置
├── src/
│   ├── types/api.ts                # 前后端 100% 共享的 TypeScript 契约定义
│   ├── db/index.ts                 # IndexedDB 本地持久化 (Dexie.js)
│   ├── services/
│   │   ├── codeParser.ts           # 验证码智能提取与分析引擎
│   │   └── scheduler.ts            # 并发调度池、状态机与 429 熔断引擎 (默认 180S 周期)
│   ├── components/
│   │   ├── mail/
│   │   │   ├── Mail.vue            # 三栏可调主工作台 (Shadcn Mail 架构)
│   │   │   ├── AccountSwitcher.vue # 账号切换下拉框
│   │   │   ├── MailNav.vue         # 导航栏、资产状态看板与轮询周期调节器
│   │   │   ├── MailList.vue        # 中间邮件列表、过滤搜索与验证码雷达卡片
│   │   │   ├── MailDisplay.vue     # 沙箱阅读器 (DOMPurify iframe) 与 RFC822 报头分析器
│   │   │   └── AccountManager.vue  # 账号资产全量管理视图 (一键复制邮箱)
│   │   └── modals/
│   │       ├── ImportModal.vue     # 多格式智能导入弹窗
│   │       └── ExportModal.vue     # 滚动最新凭证导出弹窗
│   ├── App.vue
│   ├── main.ts
│   └── assets/style.css
├── e2e/
│   └── workbench.spec.ts           # Playwright 端到端自动化测试
├── tests/
│   ├── codeParser.test.ts          # 验证码解析单元测试
│   ├── deadMarkers.test.ts         # 死号标记测试
│   └── runE2E.mjs                  # Playwright E2E 调度运行脚本
├── scripts/
│   └── build-zip.mjs               # 跨平台一键生成 dist.zip 部署包脚本
├── .env.example                    # 环境变量公开参考模版
├── .gitignore                      # 工业级版本库忽略规则
├── package.json
├── vite.config.ts
├── playwright.config.ts
└── tsconfig.json
```

---

## 🔒 隐私与安全性声明

1. **绝对纯净的客户端存储**：
   - 您的所有邮箱账号、密码、Refresh Token 以及拉取到的历史邮件，**100% 仅保存在您当前浏览器的本地 IndexedDB 数据库中**；
   - 系统没有中心化后端数据库，绝不会向任何第三方服务器收集、上传或留存您的任何凭证。
2. **纯无状态的边缘网关**：
   - 边缘端（`/functions`）仅作为解决浏览器跨域限制与公共 Client ID 轮换的轻量代理，计算过程即用即销，内存不持久化任何数据。
3. **HTML 邮件安全沙箱隔离**：
   - 邮件正文渲染严格经过 `DOMPurify` 消毒，并在配置了安全隔离策略的 `iframe` 沙箱中呈现，杜绝外部恶意 JavaScript 脚本与 Cookie 窃取。

---

## 📄 开源协议

本项目基于 **[GNU General Public License v3.0 (GPL-3.0)](LICENSE)** 协议开源。
