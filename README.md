# MyChat

<p align="center">
  <img src="https://img.shields.io/badge/React%20Native-0.79.2-blue?logo=react" alt="React Native">
  <img src="https://img.shields.io/badge/Expo-54.0.0-black?logo=expo" alt="Expo">
  <img src="https://img.shields.io/badge/TypeScript-5.3.3-blue?logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License">
</p>

<p align="center">
  <strong>跨平台 AI 聊天应用</strong><br>
  支持 iOS、Android、Web/Desktop，开箱即用连接 Ollama
</p>

---

## ✨ 功能特性

- 🤖 **AI 聊天** - 流式对话，支持打字机效果（Web）
- 🔧 **灵活配置** - 支持 Ollama、llama.cpp 等 OpenAI 兼容 API
- 📱 **跨平台** - iOS、Android、Web/Desktop 一套代码
- 🎨 **响应式设计** - 自动适配不同屏幕尺寸
- 🌙 **深色模式** - 自动跟随系统主题
- 💾 **本地存储** - 对话历史持久化保存
- ⌨️ **快捷键** - Ctrl+Enter 快速发送消息

## 📸 截图

| 桌面端 | 移动端 |
|:---:|:---:|
| 侧边栏布局 | 底部标签导航 |
| 宽屏优化 | 触控友好 |

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm start
```

### 运行应用

| 平台 | 命令 | 说明 |
|------|------|------|
| iOS | `npm run ios` | 需要 Xcode |
| Android | `npm run android` | 需要 Android Studio |
| Web | `npm run web` | 浏览器访问 localhost:8081 |

### 使用 Expo Go

1. 下载 [Expo Go](https://expo.dev/client) 应用
2. 运行 `npm start`
3. 扫描二维码

## ⚙️ 配置 Ollama（默认）

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

默认配置：
- **服务器地址**: `http://localhost:11434/v1`
- **模型**: `qwen3:0.6b`
- **API Key**: `ollama`

## 🔧 配置其他后端

### llama.cpp

```bash
./llama-server -m model.gguf --host 0.0.0.0 --port 8080
```

设置中修改：
- 服务器地址: `http://YOUR_IP:8080/v1`
- 模型名称: 任意

### OpenAI

- 服务器地址: `https://api.openai.com/v1`
- API Key: 你的 OpenAI API Key
- 模型名称: `gpt-4o` 等

## 📁 项目结构

```
mychat/
├── App.tsx                    # 应用入口
├── src/
│   ├── components/            # UI 组件
│   │   ├── ChatInput.tsx      # 聊天输入框
│   │   ├── MessageBubble.tsx  # 消息气泡
│   │   └── ConversationItem.tsx
│   ├── context/
│   │   └── ChatContext.tsx    # 全局状态管理
│   ├── navigation/
│   │   ├── MainNavigator.tsx  # 移动端导航
│   │   └── AppNavigator.tsx   # 桌面端导航
│   ├── screens/
│   │   ├── ChatScreen.tsx     # 聊天页面
│   │   ├── ConversationsScreen.tsx
│   │   └── SettingsScreen.tsx
│   ├── services/
│   │   ├── api.ts             # API 调用
│   │   └── storage.ts         # 本地存储
│   ├── theme/                 # 主题样式
│   ├── types/                 # TypeScript 类型
│   └── utils/                 # 工具函数
└── package.json
```

## 🛠️ 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | React Native + Expo |
| 语言 | TypeScript |
| 导航 | React Navigation 7 |
| 存储 | AsyncStorage |
| Web | react-native-web |

## 📦 构建

### Web

```bash
npm run build:web
```

产物位于 `web-build/` 目录。

### 原生应用

使用 [EAS Build](https://docs.expo.dev/build/introduction/)：

```bash
# 安装 EAS CLI
npm install -g eas-cli

# 登录
eas login

# 构建
eas build --platform ios
eas build --platform android
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

[MIT](LICENSE)

---

<p align="center">
  Made with ❤️ using React Native & Expo
</p>
