.PHONY: all install start dev build clean test lint help \
        engine-download engine-check engine-update \
        model-download model-check \
        electron-dev electron-build electron-build-mac electron-build-win \
        web-build web-start \
        test-unit test-watch test-coverage \
        clean-build clean-cache clean-all

SHELL := /bin/bash
NODE_MODULES := node_modules
NPM := npm
ELECTRON := electron

all: install

install: ## 安装依赖
	@echo "📦 安装依赖..."
	$(NPM) install
	@echo "✅ 依赖安装完成"

start: ## 启动 Expo 开发服务器
	@echo "🚀 启动 Expo 开发服务器..."
	$(NPM) start

dev: electron-dev ## 启动 Electron 开发模式

electron-dev: ## 启动 Electron 开发模式
	@echo "🖥️ 启动 Electron 开发模式..."
	$(NPM) run electron:dev

web-start: ## 启动 Web 开发服务器
	@echo "🌐 启动 Web 开发服务器..."
	$(NPM) run web

web-build: ## 构建 Web 版本
	@echo "🏗️ 构建 Web 版本..."
	$(NPM) run build:web

test: test-unit ## 运行测试

test-unit: ## 运行单元测试
	@echo "🧪 运行单元测试..."
	$(NPM) test

test-watch: ## 监听模式运行测试
	@echo "👀 监听模式运行测试..."
	$(NPM) run test:watch

test-coverage: ## 运行测试并生成覆盖率报告
	@echo "📊 运行测试并生成覆盖率报告..."
	$(NPM) run test:coverage
	@echo "📄 覆盖率报告已生成: coverage/lcov-report/index.html"

lint: ## 运行代码检查
	@echo "🔍 运行代码检查..."
	$(NPM) run lint

typecheck: ## TypeScript 类型检查
	@echo "📝 TypeScript 类型检查..."
	npx tsc --noEmit

ci: lint typecheck test ## CI 流程: 代码检查 + 类型检查 + 测试
	@echo "✅ CI 检查完成"

engine-download: ## 下载所有引擎 (llama, zeroclaw)
	@echo "⬇️ 下载引擎..."
	$(NPM) run engine:download

engine-check: ## 检查引擎安装状态
	@echo "🔍 检查引擎安装状态..."
	$(NPM) run engine:check

engine-update: ## 更新引擎到最新版本
	@echo "🔄 更新引擎..."
	node scripts/download-engines.js update llama
	node scripts/download-engines.js update zeroclaw

model-download: ## 下载默认模型
	@echo "⬇️ 下载默认模型..."
	$(NPM) run model:download

model-check: ## 检查模型下载状态
	@echo "🔍 检查模型下载状态..."
	$(NPM) run model:check

model-config: ## 生成模型池配置文件
	@echo "📝 生成模型池配置文件..."
	node scripts/generate-model-config.js

model-pool-start: ## 启动模型池服务
	@echo "🚀 启动模型池服务..."
	@echo "使用方法: 在应用中点击'启动模型池'按钮"

electron-build: web-build ## 构建 Electron 应用 (当前平台)
	@echo "📦 构建 Electron 应用..."
	$(NPM) run electron:build

electron-build-mac: ## 构建 macOS 版本
	@echo "🍎 构建 macOS 版本..."
	$(NPM) run electron:build:mac

electron-build-win: ## 构建 Windows 版本
	@echo "🪟 构建 Windows 版本..."
	$(NPM) run electron:build:win

electron-build-all: ## 构建所有平台版本
	@echo "🌍 构建所有平台版本..."
	$(NPM) run electron:build:all

build: electron-build ## 构建应用 (默认当前平台)

build-mac: electron-build-mac ## 构建 macOS 版本

build-win: electron-build-win ## 构建 Windows 版本

build-all: electron-build-all ## 构建所有平台版本

clean-build: ## 清理构建输出
	@echo "🧹 清理构建输出..."
	rm -rf desktop-build
	rm -rf dist
	rm -rf web-build
	@echo "✅ 构建输出已清理"

clean-cache: ## 清理缓存
	@echo "🧹 清理缓存..."
	rm -rf .expo
	rm -rf node_modules/.cache
	rm -rf $(NODE_MODULES)/.cache
	@echo "✅ 缓存已清理"

clean-modules: ## 清理 node_modules
	@echo "🧹 清理 node_modules..."
	rm -rf $(NODE_MODULES)
	@echo "✅ node_modules 已清理"

clean-all: clean-build clean-cache clean-modules ## 清理所有生成的文件
	@echo "✅ 所有清理完成"

clean: clean-build ## 清理 (默认只清理构建输出)

dev-setup: install engine-download model-download ## 完整开发环境设置
	@echo "✅ 开发环境设置完成"

release-mac: ## 发布 macOS 版本 (包含完整构建)
	@echo "🚀 准备发布 macOS 版本..."
	$(MAKE) clean-build
	$(MAKE) electron-build-mac
	@echo "✅ macOS 版本构建完成，输出目录: desktop-build/"

release-win: ## 发布 Windows 版本 (包含完整构建)
	@echo "🚀 准备发布 Windows 版本..."
	$(MAKE) clean-build
	$(MAKE) electron-build-win
	@echo "✅ Windows 版本构建完成，输出目录: desktop-build/"

release-all: ## 发布所有平台版本
	@echo "🚀 准备发布所有平台版本..."
	$(MAKE) clean-build
	$(MAKE) electron-build-all
	@echo "✅ 所有平台版本构建完成，输出目录: desktop-build/"

version: ## 显示版本号
	@node -p "require('./package.json').version"

run: ## 快速启动开发环境
	@$(MAKE) electron-dev

run-mac: ## 运行 macOS 构建
	@echo "🏃 运行 macOS 构建..."
	open desktop-build/mac-arm64/MyChat.app || open desktop-build/mac/MyChat.app || open desktop-build/*.app

info: ## 显示项目信息
	@echo "📋 项目信息"
	@echo "================"
	@echo "名称: MyChat"
	@echo "版本: $$(node -p "require('./package.json').version")"
	@echo "Node: $$(node -v)"
	@echo "NPM: $$(npm -v)"
	@echo "平台: $$(uname -s)"
	@echo "架构: $$(uname -m)"
	@echo ""
	@echo "📁 项目结构:"
	@echo "  - 源代码: src/"
	@echo "  - Electron: electron/"
	@echo "  - 引擎: engine-binaries/"
	@echo "  - 模型: default-model/"
	@echo "  - 构建: desktop-build/"

help: ## 显示帮助信息
	@echo "MyChat Makefile 帮助"
	@echo "===================="
	@echo ""
	@echo "使用方法: make [目标]"
	@echo ""
	@echo "开发命令:"
	@grep -E '^dev-setup|^start|^dev|^web-start|^test|^lint|^typecheck' $(MAKEFILE_LIST) | sed 's/:\([^:]*\)$$/:\1/' | column -t -s ':'
	@echo ""
	@echo "构建命令:"
	@grep -E '^build|^electron-build|^web-build' $(MAKEFILE_LIST) | sed 's/:\([^:]*\)$$/:\1/' | column -t -s ':'
	@echo ""
	@echo "发布命令:"
	@grep -E '^release' $(MAKEFILE_LIST) | sed 's/:\([^:]*\)$$/:\1/' | column -t -s ':'
	@echo ""
	@echo "引擎和模型:"
	@grep -E '^engine|^model' $(MAKEFILE_LIST) | sed 's/:\([^:]*\)$$/:\1/' | column -t -s ':'
	@echo ""
	@echo "清理命令:"
	@grep -E '^clean' $(MAKEFILE_LIST) | sed 's/:\([^:]*\)$$/:\1/' | column -t -s ':'
	@echo ""
	@echo "其他:"
	@grep -E '^install|^info|^help' $(MAKEFILE_LIST) | sed 's/:\([^:]*\)$$/:\1/' | column -t -s ':'

.DEFAULT_GOAL := help
