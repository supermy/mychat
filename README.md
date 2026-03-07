# MyChat

<p align="center">
  <img src="https://img.shields.io/badge/React%20Native-0.81.5-blue?logo=react" alt="React Native">
  <img src="https://img.shields.io/badge/Expo-54.0.0-black?logo=expo" alt="Expo">
  <img src="https://img.shields.io/badge/TypeScript-5.9.2-blue?logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/Electron-28.0.0-blue?logo=electron" alt="Electron">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License">
</p>

<p align="center">
  <strong>跨平台 AI 聊天应用</strong><br>
  支持 iOS、Android、Web/Desktop，开箱即用连接 Ollama<br>
  桌面版内置 llama.cpp 引擎，支持本地模型推理
</p>

---

## ✨ 功能特性

- 🤖 **AI 聊天** - 流式对话，支持打字机效果（Web）
- 🔧 **灵活配置** - 支持 Ollama、llama.cpp 等 OpenAI 兼容 API
- 📱 **跨平台** - iOS、Android、Web/Desktop 一套代码
- 🖥️ **桌面版特色**
  - 内置 llama.cpp 引擎
  - 自动检测系统内存，推荐合适模型
  - 支持模型下载和管理
  - 支持 macOS (Intel/Apple Silicon) 和 Windows
- 🎨 **响应式设计** - 自动适配不同屏幕尺寸
- 🌙 **深色模式** - 自动跟随系统主题
- 💾 **本地存储** - 对话历史持久化保存
- ⌨️ **快捷键** - Ctrl+Enter 快速发送消息

## 📦 支持的模型

| 模型 | 参数量 | Q4_K_XL 大小 | 最小内存 | 推荐内存 |
|------|--------|-------------|---------|---------|
| Qwen3.5-2B | 2B | ~1.4 GB | 4 GB | 6 GB |
| GLM-4.7-Flash | 10B | ~4.2 GB | 6 GB | 8 GB |
| AgentCPM-Explore | 8B | ~8 GB | 12 GB | 16 GB |
| Qwen3.5-35B-A3B | 35B MoE | ~18 GB | 24 GB | 32 GB |

## 🚀 快速开始

### 移动端 / Web

```bash
# 安装依赖
npm install

# 启动开发服务器
npm start

# 运行 Web 版
npm run web

# 运行 iOS
npm run ios

# 运行 Android
npm run android
```

### 桌面版 (macOS / Windows)

```bash
# 1. 安装依赖
npm install

# 2. 下载 llama.cpp 二进制文件
node scripts/download-llama.js

# 3. 启动桌面应用
npm run electron:dev

# 4. 构建安装包
npm run electron:build:mac    # macOS
npm run electron:build:win    # Windows
```

## ⚙️ 配置 Ollama（移动端/Web）

应用默认配置支持 Ollama，开箱即用：

```bash
# 安装 Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# 拉取模型
ollama pull qwen3:0.6b

# 启动服务
ollama serve

# 允许跨域（Web 端需要）
OLLAMA_ORIGINS="*" ollama serve
```

## 🖥️ 桌面版使用指南

### 1. 下载模型

在桌面应用中点击「模型」标签：
- 系统会自动检测内存并推荐合适的模型
- 默认选择 Q4_K_XL 量化版本
- 点击「下载」按钮从 ModelScope 下载模型

### 2. 启动模型

- 下载完成后点击「启动」按钮
- 模型会使用 llama.cpp 引擎运行
- 支持自动 GPU 加速（如有 GPU）

### 3. 开始聊天

- 切换到「聊天」标签
- 输入消息开始对话
- 使用 Ctrl+Enter 快速发送

## 📁 项目结构

```
mychat/
├── App.tsx                    # 应用入口
├── electron/                  # Electron 桌面应用
│   ├── main.js               # 主进程
│   ├── preload.js            # 预加载脚本
│   └── package.json          # Electron 配置
├── scripts/
│   └── download-llama.js     # llama.cpp 下载脚本
├── llama-binaries/           # llama.cpp 二进制文件
│   ├── darwin/               # macOS
│   └── win32/                # Windows
├── src/
│   ├── components/           # UI 组件
│   ├── context/              # 状态管理
│   ├── navigation/           # 导航配置
│   ├── screens/              # 页面组件
│   │   ├── ChatScreen.tsx
│   │   ├── ModelsScreen.tsx  # 模型管理页面
│   │   └── SettingsScreen.tsx
│   ├── services/
│   │   ├── api.ts            # API 调用
│   │   ├── models.ts         # 模型配置和推荐
│   │   └── storage.ts        # 本地存储
│   ├── theme/                # 主题样式
│   ├── types/                # TypeScript 类型
│   └── utils/                # 工具函数
├── .github/
│   └── workflows/
│       └── build.yml         # GitHub Actions
└── package.json
```

## 🛠️ 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | React Native 0.81.5 + Expo 54 |
| 桌面应用 | Electron 28 |
| 本地推理 | llama.cpp |
| 语言 | TypeScript 5.9 |
| 导航 | React Navigation 7 |
| 存储 | AsyncStorage |

## 📦 构建发布

### GitHub Actions 自动构建

项目配置了 GitHub Actions 自动构建 iOS/Android/Web 版本：

1. 在 GitHub 仓库设置中添加 `EXPO_TOKEN` secret
2. 推送代码或创建 tag 自动触发构建

### 桌面版构建

```bash
# macOS (支持 Intel 和 Apple Silicon)
npm run electron:build:mac

# Windows
npm run electron:build:win

# 全平台
npm run electron:build:all
```

构建产物位于 `desktop-build/` 目录。

## 🔧 开发说明

### 添加新模型

编辑 `src/services/models.ts`：

```typescript
{
  id: 'new-model',
  name: 'New Model',
  description: '模型描述',
  baseUrl: 'https://www.modelscope.cn/models/xxx/files',
  files: [
    { name: 'model-Q4_K_XL.gguf', quantization: 'Q4_K_XL', size: 4 * 1024 * 1024 * 1024, recommended: true },
  ],
  minRam: 8,
  recommendedRam: 12,
  parameters: '7B',
  contextLength: 4096
}
```

### 自定义 llama.cpp 参数

编辑 `electron/main.js` 中的 `startLlamaServer` 函数。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

[MIT](LICENSE)

---

<p align="center">
  Made with ❤️ using React Native, Expo & Electron
</p>
