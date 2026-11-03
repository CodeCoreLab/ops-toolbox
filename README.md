# 运维轻量化工具箱

> 20+ 高频运维工具集成于单文件，**完全离线可用**，敏感数据不出本机。

面向 DevOps / SRE / 运维工程师，解决日常「临时找一个工具转换一下」的场景 —— 不用装软件、不用开浏览器插件、不用把配置和凭据传到第三方网站。

在线体验：<https://xmtooldev.gf.com.cn/ops-toolbox/>

---

## 特性

| 特性 | 说明 |
|------|------|
| 零依赖 | 纯 HTML + 原生 JS，无框架、无 CDN、无外部请求 |
| 真离线 | 双击 `tool.html` 即可使用，断网环境同样完整功能 |
| 数据不出本机 | 所有编解码、哈希、解析均在浏览器本地完成，不发送任何数据 |
| 单文件 | 工具箱本体仅一个 `tool.html`，拷贝即带走 |
| 响应式 | 侧边栏分类导航，桌面端展开/收起，移动端汉堡菜单 |

## 工具清单（20 个）

### 编解码转换
- Base64 编解码（支持中文与特殊字符）
- URL 编解码

### 哈希与加密
- 哈希计算 MD5 / SHA-1 / SHA-256 / SHA-512
- JWT 令牌解析（Header / Payload / 过期检测）

### 文本处理
- JSON 格式化 / 压缩 / 转义
- 文本对比 Diff
- 文本常用操作（大小写、去空白、字符串统计）
- Markdown ↔ HTML 双向转换
- 正则表达式测试（实时匹配高亮）

### 生成与随机
- 密码 / 随机字符串生成
- UUID / 随机数生成（v4 / v1）
- 密码强度检测

### 格式转换
- Unix 时间戳 ↔ 日期（本地 / UTC / ISO，毫秒自动识别）
- 颜色格式 HEX / RGB / HSL 互转
- 进制转换（二 / 八 / 十 / 十六）
- 常用单位转换（存储大小 / 时间）

### 网络与运维
- 常用运维命令生成（Linux / Docker / K8s / Nginx）
- 常用端口速查
- IP / CIDR 子网计算（网络地址、广播地址、可用范围）

### 列表工具
- 列表去重 / 排序

## 目录结构

```
ops-toolbox/
├── index.html               # 产品介绍页（落地页）
├── tool.html                # 工具箱本体（单文件，离线核心）
├── changelog.html           # 更新日志
├── README.md                # 本文件
└── ops-toolbox-offline.zip  # 离线打包版本
```

## 离线使用

**方式一：直接用单个文件**

下载 `tool.html`，双击用浏览器打开即可。所有功能完整可用。

**方式二：完整包**

下载 `ops-toolbox-offline.zip`，解压后打开 `index.html`（含产品介绍与下载入口）或直接打开 `tool.html`。

> 无需安装、无需注册、无需网络环境。

## 在线地址

| 页面 | 地址 |
|------|------|
| 产品介绍页 | <https://xmtooldev.gf.com.cn/ops-toolbox/> |
| 工具箱本体 | <https://xmtooldev.gf.com.cn/ops-toolbox/tool.html> |
| 更新日志 | <https://xmtooldev.gf.com.cn/ops-toolbox/changelog.html> |

## 浏览器要求

现代浏览器（Chrome / Edge / Firefox / Safari 最近两个大版本）。MD5 哈希依赖浏览器 `crypto.subtle`，需 **HTTPS 或 `file://` 协议**下可用。

## 致谢

基于 DevHub 等开源项目的实现思路二次开发，向原项目作者致谢。

## License

MIT
