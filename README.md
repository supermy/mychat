# MyChat

<p align="center">
  <img src="https://img.shields.io/badge/React%20Native-0.81.5-blue?logo=react" alt="React Native">
  <img src="https://img.shields.io/badge/Expo-54.0.0-black?logo=expo" alt="Expo">
  <img src="https://img.shields.io/badge/Electron-28.0.0-blue?logo=electron" alt="Electron">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License">
</p>

<p align="center">
  <strong>跨平台 AI 聊天应用</strong><br>
  支持 iOS、Android、Web/Desktop，内置 llama.cpp 推理引擎<br>
  打包默认模型 Qwen3.5-0.8B，开箱即用<br>
  支持 SSH 远程服务器管理
</p>

---

## ✨ 功能特性

- 🤖 **AI 聊天** - 流式对话，支持打字机效果
- 🔧 **多引擎支持**
  - **llama.cpp** - 最流行的本地 LLM 推理引擎，支持 Vulkan GPU 加速
  - **外部服务** - Ollama、OpenAI 等
- 📱 **跨平台** - iOS、Android、Web/Desktop
- 🖥️ **桌面版特色**
  - 内置推理引擎，开箱即用
  - 内置默认模型 Qwen3.5-0.8B
  - 配置向导，新手友好
  - 自动检测系统配置，推荐合适模型
  - 支持模型下载和管理
- 🌐 **SSH 远程服务器支持**
  - 远程模型池管理
  - 远程模型下载
  - 远程引擎下载与更新
  - 自动检测远程 GPU (NVIDIA/AMD)
  - Vulkan GPU 加速支持
- 🎨 **响应式设计** - 自动适配不同屏幕尺寸
- 🌙 **深色模式** - 自动跟随系统主题

## 📦 内置模型

| 模型 | 参数量 | 大小 | 说明 |
|------|--------|------|------|
| **Qwen3.5-0.8B** | 0.8B | ~500MB | 默认内置，开箱即用 |

## 📦 支持下载的模型

| 模型 | 参数量 | Q4_K_XL 大小 | 最小内存 |
|------|--------|-------------|---------|
| Qwen3.5-0.8B | 0.8B | ~0.5 GB | 2 GB |
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
| **llama.cpp** | 功能全面，社区活跃，支持 GPU | 通用场景 |
| **外部服务** | 无需安装 | 已有 Ollama 等服务 |

### 步骤 2：下载引擎（如需要）

如果选择 llama.cpp，向导会自动下载对应平台的二进制文件。
- CPU 版本：适用于无 GPU 的系统
- Vulkan 版本：适用于 NVIDIA/AMD GPU，自动检测并下载

### 步骤 3：配置模型

- 选择内置模型 Qwen3.5-0.8B
- 或选择已下载的 GGUF 模型
- 或从 ModelScope 下载新模型
- 配置上下文大小、线程数等参数

### 步骤 4：测试连接

向导会测试引擎是否正常工作。

### 步骤 5：完成

配置保存后即可开始聊天！

## 🌐 SSH 远程服务器

MyChat 支持通过 SSH 连接远程服务器进行模型管理：

### 功能

- **远程模型池管理** - 启动/停止远程模型池服务
- **远程模型下载** - 直接下载模型到远程服务器
- **远程引擎管理** - 下载/更新远程推理引擎
- **GPU 自动检测** - 自动检测 NVIDIA/AMD GPU 并下载对应版本
- **资源感知推荐** - 根据远程服务器资源推荐合适模型

### 配置 SSH 连接

1. 在「模型」页面选择「远程」安装目标
2. 填写 SSH 连接信息：
   - 主机地址
   - 端口（默认 22）
   - 用户名
   - 密码或密钥路径
3. 点击「测试连接」验证连接并获取服务器信息

### GPU 支持

远程服务器 GPU 检测支持：
- **NVIDIA** - 通过 nvidia-smi 检测
- **AMD** - 通过 lspci 检测
- **Vulkan** - 通用 GPU 加速，支持 NVIDIA 和 AMD

安装 GPU 加速版本需要：
```bash
# Ubuntu/Debian
sudo apt install vulkan-tools
```

## 🛠️ 命令参考

### 开发命令

```bash
npm start              # 启动 Expo 开发服务器
npm run web            # 启动 Web 版本
npm run electron:dev   # 启动桌面开发版
```

### 测试命令

```bash
npm test               # 运行单元测试
npm run test:watch     # 监听模式运行测试
npm run test:coverage  # 运行测试并生成覆盖率报告
make test              # 使用 Makefile 运行测试
make test-coverage     # 生成覆盖率报告
make ci                # CI 流程: lint + typecheck + test
```

### 引擎管理

```bash
npm run engine:download           # 下载当前平台的引擎
npm run engine:download llama     # 只下载 llama.cpp
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

### Makefile 命令

```bash
make help           # 显示所有可用命令
make install        # 安装依赖
make dev            # 启动开发模式
make test           # 运行测试
make test-coverage  # 测试覆盖率
make lint           # 代码检查
make typecheck      # 类型检查
make ci             # CI 完整流程
make build-mac      # 构建 macOS 版本
make build-win      # 构建 Windows 版本
make clean          # 清理构建输出
```

## 📁 项目结构

```
mychat/
├── App.tsx                    # 应用入口
├── electron/                  # Electron 桌面应用
│   ├── main.js               # 主进程
│   ├── preload.js            # 预加载脚本
│   └── storage.js            # 配置存储
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
│   │   ├── ModelsScreen.tsx  # 模型管理（含 SSH 远程支持）
│   │   └── SettingsScreen.tsx
│   ├── services/
│   │   ├── api.ts            # API 调用
│   │   └── models.ts         # 模型配置与推荐
│   ├── theme/                # 主题样式
│   ├── types/                # TypeScript 类型定义
│   │   └── electron.ts       # Electron API 类型
│   └── utils/                # 工具函数
├── __tests__/                # 单元测试
│   ├── models.test.ts        # 模型服务测试
│   ├── engine.test.ts        # 引擎下载测试
│   ├── ssh.test.ts           # SSH 连接测试
│   └── storage.test.ts       # 存储测试
├── jest.config.js            # Jest 配置
├── package.json
├── Makefile                  # Make 命令
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

## 📥 下载

### GitHub Releases

从 [Releases](https://github.com/supermy/mychat/releases) 页面下载最新版本：

- **macOS**: MyChat-x.x.x-arm64.dmg (Apple Silicon) / MyChat-x.x.x.dmg (Intel)
- **Windows**: MyChat Setup x.x.x.exe

### 安装包内容

| 组件 | 说明 |
|------|------|
| MyChat 应用 | 主程序 |
| llama.cpp 引擎 | 本地推理引擎（支持 Vulkan GPU） |
| Qwen3.5-0.8B | 默认内置模型 |

## 🧪 测试

### 运行测试

```bash
# 运行所有测试
npm test

# 监听模式
npm run test:watch

# 生成覆盖率报告
npm run test:coverage
```

### 测试覆盖

- **模型推荐** - 根据内存和 GPU 推荐合适模型
- **引擎下载** - 版本解析、URL 生成、平台检测
- **SSH 连接** - 配置验证、资源探测
- **存储** - 配置持久化

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

### 开发流程

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

### 代码规范

- 运行 `make lint` 检查代码风格
- 运行 `make typecheck` 检查类型
- 运行 `make test` 确保测试通过
- 运行 `make ci` 执行完整 CI 流程

## 📄 许可证

[MIT](LICENSE)

---

<p align="center">
  Made with ❤️ using React Native, Expo & Electron
</p>
