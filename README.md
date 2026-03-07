# MyChat

<p align="center">
  <img src="https://img.shields.io/badge/React%20Native-0.81.5-blue?logo=react" alt="React Native">
  <img src="https://img.shields.io/badge/Expo-54.0.0-black?logo=expo" alt="Expo">
  <img src="https://img.shields.io/badge/Electron-28.0.0-blue?logo=electron" alt="Electron">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License">
</p>

<p align="center">
  <strong>跨平台 AI 聊天应用</strong><br>
  支持 iOS、Android、Web/Desktop，内置 llama.cpp 和 ZeroClaw 推理引擎<br>
  打包默认模型 Qwen3.5-0.8B，开箱即用
</p>

---

## ✨ 功能特性

- 🤖 **AI 聊天** - 流式对话，支持打字机效果
- 🔧 **多引擎支持**
  - **llama.cpp** - 最流行的本地 LLM 推理引擎
  - **ZeroClaw** - 极致性能，内存占用仅 7.8MB
  - **外部服务** - Ollama、OpenAI 等
- 📱 **跨平台** - iOS、Android、Web/Desktop
- 🖥️ **桌面版特色**
  - 内置推理引擎，开箱即用
  - 内置默认模型 Qwen3.5-0.8B
  - 配置向导，新手友好
  - 自动检测系统配置，推荐合适模型
  - 支持模型下载和管理
- 🎨 **响应式设计** - 自动适配不同屏幕尺寸
- 🌙 **深色模式** - 自动跟随系统主题

## 📦 内置模型

| 模型 | 参数量 | 大小 | 说明 |
|------|--------|------|------|
| **Qwen3.5-0.8B** | 0.8B | ~500MB | 默认内置，开箱即用 |

## 📦 支持下载的模型

| 模型 | 参数量 | Q4_K_XL 大小 | 最小内存 |
|------|--------|-------------|---------|
| Qwen3.5-2B | 2B | ~1.4 GB | 4 GB |
| GLM-4.7-Flash | 10B | ~4.2 GB | 6 GB |
| AgentCPM-Explore | 8B | ~8 GB | 12 GB |
| Qwen3.5-35B-A3B | 35B MoE | ~18 GB | 24 GB |

## 🚀 快速开始

### 移动端 / Web

```bash
npm install
npm start
```

### 桌面版

```bash
# 1. 安装依赖
npm install

# 2. 启动桌面应用
npm run electron:dev

# 3. 首次运行会显示配置向导
```

## 📖 配置向导

首次运行桌面应用时，会自动显示配置向导：

### 步骤 1：选择推理引擎

| 引擎 | 特点 | 适用场景 |
|------|------|---------|
| **llama.cpp** | 功能全面，社区活跃 | 通用场景 |
| **ZeroClaw** | 极致性能，内存占用低 | 资源受限环境 |
| **外部服务** | 无需安装 | 已有 Ollama 等服务 |

### 步骤 2：下载引擎（如需要）

如果选择 llama.cpp 或 ZeroClaw，向导会自动下载对应平台的二进制文件。

### 步骤 3：配置模型

- 选择内置模型 Qwen3.5-0.8B
- 或选择已下载的 GGUF 模型
- 或从 ModelScope 下载新模型
- 配置上下文大小、线程数等参数

### 步骤 4：测试连接

向导会测试引擎是否正常工作。

### 步骤 5：完成

配置保存后即可开始聊天！

## 🛠️ 命令参考

### 开发命令

```bash
npm start              # 启动 Expo 开发服务器
npm run web            # 启动 Web 版本
npm run electron:dev   # 启动桌面开发版
```

### 引擎管理

```bash
npm run engine:download           # 下载当前平台的引擎
npm run engine:download llama     # 只下载 llama.cpp
npm run engine:download zeroclaw  # 只下载 ZeroClaw
npm run engine:download all       # 下载所有平台
npm run engine:check              # 检查已安装的引擎
```

### 模型管理

```bash
npm run model:download            # 下载默认模型
npm run model:check               # 检查模型状态
```

### 构建命令

```bash
npm run build:web           # 构建 Web 版本
npm run electron:build:mac  # 构建 macOS 应用（含引擎+模型）
npm run electron:build:win  # 构建 Windows 应用（含引擎+模型）
npm run electron:build:all  # 构建所有平台
```

## 📁 项目结构

```
mychat/
├── App.tsx                    # 应用入口
├── electron/                  # Electron 桌面应用
│   ├── main.js               # 主进程
│   └── preload.js            # 预加载脚本
├── scripts/
│   ├── download-engines.js   # 引擎下载脚本
│   └── download-model.js     # 模型下载脚本
├── engine-binaries/          # 引擎二进制文件
│   ├── darwin/               # macOS
│   └── win32/                # Windows
├── default-model/            # 默认模型
│   └── Qwen3.5-0.8B-UD-Q4_K_XL.gguf
├── src/
│   ├── components/           # UI 组件
│   │   └── SetupWizard.tsx   # 配置向导
│   ├── context/              # 状态管理
│   ├── navigation/           # 导航配置
│   ├── screens/              # 页面组件
│   │   ├── ChatScreen.tsx
│   │   ├── ModelsScreen.tsx
│   │   └── SettingsScreen.tsx
│   ├── services/
│   │   ├── api.ts            # API 调用
│   │   └── models.ts         # 模型配置
│   ├── theme/                # 主题样式
│   └── utils/                # 工具函数
├── package.json
├── README.md
└── CHANGELOG.md
```

## 🔧 手动配置

### 使用外部 Ollama

1. 安装并启动 Ollama：
```bash
ollama serve
```

2. 在设置中选择「外部服务」
3. 配置服务器地址：`http://localhost:11434/v1`

### 使用外部 llama.cpp server

```bash
# 启动 llama.cpp server
./llama-server -m model.gguf --port 8080

# 在设置中配置
# 服务器地址: http://localhost:8080/v1
```

## 📋 引擎对比

| 特性 | llama.cpp | ZeroClaw |
|------|-----------|----------|
| 内存占用 | 较高 | 极低 (7.8MB) |
| 启动速度 | 秒级 | 毫秒级 |
| 模型支持 | 广泛 | GGUF |
| GPU 加速 | 支持 | 支持 |
| 适用场景 | 通用 | 资源受限 |

## 📥 下载

### GitHub Releases

从 [Releases](https://github.com/supermy/mychat/releases) 页面下载最新版本：

- **macOS**: MyChat-x.x.x-arm64.dmg (Apple Silicon) / MyChat-x.x.x.dmg (Intel)
- **Windows**: MyChat Setup x.x.x.exe

### 安装包内容

| 组件 | 说明 |
|------|------|
| MyChat 应用 | 主程序 |
| llama.cpp 引擎 | 本地推理引擎 |
| ZeroClaw 引擎 | 轻量级推理引擎 |
| Qwen3.5-0.8B | 默认内置模型 |

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

[MIT](LICENSE)

---

<p align="center">
  Made with ❤️ using React Native, Expo & Electron
</p>
