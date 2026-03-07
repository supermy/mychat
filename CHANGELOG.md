# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-03-07

### Added
- ZeroClaw 引擎支持 - 极致性能，内存占用仅 7.8MB
- 配置向导功能 - 首次运行自动引导配置
- 引擎测试功能 - 测试引擎是否正常工作
- 多引擎管理 - 支持 llama.cpp、ZeroClaw、外部服务
- 默认模型打包 - Qwen3.5-0.8B 内置，开箱即用
- GitHub Actions 自动构建 - iOS/Android/Web 自动化构建
- 模型下载功能 - 从 ModelScope 下载模型
- 模型推荐系统 - 根据系统内存推荐合适模型

### Changed
- 更好的错误处理和用户提示
- 更清晰的代码结构和模块划分
- 完善的项目文档和使用说明

### Fixed
- React Native 流式响应问题 - 使用非流式请求兼容
- UUID 生成兼容性问题 - 使用自定义 UUID 生成函数
- 依赖版本兼容性问题 - 更新到 Expo SDK 54 要求的版本
- Electron 构建配置问题 - 修复入口文件和资源配置
- Node.js 版本要求问题 - 在 eas.json 中指定 Node.js 22
- GitHub Actions 构建失败问题 - 修复 package-lock.json 同步
- 大文件 Git 提交问题 - 使用 .gitignore 排除构建产物
- TypeScript 编译错误 - 修复类型定义和导入问题
- API 调用兼容性问题 - 支持 OpenAI 兼容 API

## [0.1.0] - 2026-03-06

### Added
- 初始版本发布
- 基础 AI 聊天功能
- Ollama API 支持
- 流式对话响应 (Web)
- 移动端支持 (iOS/Android)
- Web 支持
- 深色模式 - 自动跟随系统主题
- 本地存储 - 对话历史持久化
- GitHub Actions CI/CD
- EAS Build 配置
- 完整项目文档
- MIT 许可证

### Technical Stack
- React Native 0.81.5
- Expo 54
- React Navigation 7
- TypeScript 5.9
- AsyncStorage

---

[0.1.1]: https://github.com/supermy/mychat/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/supermy/mychat/releases/tag/v0.1.0
