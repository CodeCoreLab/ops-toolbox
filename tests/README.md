# E2E 回归测试

用真实浏览器（Playwright）验证运维工具箱的线上页面与离线包行为。
所有路径基于脚本自身位置推导，不依赖特定机器的绝对路径。

## 环境准备

```bash
# 方式一：本地安装
npm i playwright
npx playwright install chromium

# 方式二：全局安装（需指定 NODE_PATH）
# Windows
set NODE_PATH=E:/npm-global/node_modules
# macOS / Linux
export NODE_PATH=/usr/local/lib/node_modules
```

## 运行

```bash
node tests/e2e_online.js    # 线上站点回归（43 项断言）
node tests/e2e_offline.js   # 离线包自包含回归（21 项断言）
```

### 可选环境变量

| 变量 | 说明 | 默认值 |
|---|---|---|
| `SITE_BASE` | 线上站点根地址 | `https://xmtooldev.gf.com.cn` |
| `OFFLINE_ZIP` | 待测离线包路径 | 仓库根 `ops-toolbox-offline.zip` |
| `PYTHON` | Python 解释器 | `python`（找不到时自动尝试 `python3` / `py`） |

## 覆盖范围

**e2e_online.js**
- 落地页导航元素：`.nav-back` 返回按钮、`.nav-gh` GitHub 图标、`.nav-dl` 下载、`.nav-cta` CTA
- 工具箱 `tool.html`：topbar / sidebar-footer 入口数量与链接目标
- 移动端（390×844）返回按钮与 GitHub 按钮可见性
- 全站 15 个工具页的 GitHub 按钮与返回链接审计；`reevelite` 为闭源产品，断言其**不应**出现 GitHub 链接
- 离线包可下载性与包内容（无 `.git` 残留、无 zip 自指死链、含 `tool.html` 入口）
- 全程零 JS 控制台错误

**e2e_offline.js**
- 解压离线包，以 `file://` 协议打开 `index.html` / `tool.html`
- 断言包内**无站内绝对地址**（离线不可达）、**无 zip 自指死链**、本地链接目标文件真实存在
- CTA 点击能真实跳转到包内 `tool.html`
- 功能回归：CIDR 掩码计算、Base64 编码
- 侧边栏 20 个工具项、移动端汉堡菜单展开
- 断言**零外部资源请求**（自包含核心指标）

## 失败排查

- `Cannot find module 'playwright'` → 检查 `NODE_PATH` 或先 `npm i playwright`
- `ERR_NAME_NOT_RESOLVED` / 超时 → 内网环境需能访问 `xmtooldev.gf.com.cn`
- 离线用例全 FAIL 且报缺文件 → 先执行 `python build_offline_zip.py` 生成离线包
