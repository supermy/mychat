## 目标：本地clow

1. 支持本地openclaw配置；
2. 支持本地claudecode配置；
3. 支持openclaw 调用claudecode;
4. llama.cpp 提供本地推理引擎池，为openclaw决策与clzudecode编码提供token；
5. 前段技术实现：

   使用 React Native + Expo 开发一个支持 iOS 和 Android 的聊天应用，使用 OpenAI 兼容格式的 API。
   支持桌面，自动适配不同屏幕尺寸。

### 本地模型池：

#### 把llama.cpp引擎整合到项目里面，打包到安装包,支持macos  与windows 平台安装；

#### 根据vram+ram推荐合适尺寸的量化gguf，默认选q4kxl，支持模型下载推理；

gguf默认下载地址：先选q4_k_x_l 没有的话选q4_k_m
https://www.modelscope.cn/models/unsloth/GLM-4.7-Flash-GGUF/files
https://www.modelscope.cn/models/unsloth/Qwen3.5-35B-A3B-GGUF/files
https://www.modelscope.cn/models/unsloth/Qwen3.5-2B-GGUF/files
https://www.modelscope.cn/models/DevQuasar/openbmb.AgentCPM-Explore-GGUF/files
gguf模型下载位置：~/.mychat/models/gguf/

#### 模型池技术实现：提供启动参数的配置界面；提供model-config.ini 的配置界面以及编辑功能

llama.cpp 启用模型池 moe
/data/ai/llama.cpp/build/bin/llama-server
  --models-preset ~/.mychat/gguf/model-config.ini   --models-dir ~/.mychat/models/gguf
  --models-max 2
  --jinja
  --host 0.0.0.0   --port 8080
  --log-file  ~/.mychat/logs/llama_server.log

切换模型
curl http://localhost:8080/v1/chat/completions
  -H "Content-Type: application/json"
  -d '{
    "model": "Qwen3.5-0.8B-UD-Q5_K_XL",
    "messages": [{"role": "user", "content": "Hello"}]
  }'

#### 支持自定义模型配置：

model-config.ini 根据下载的模型生成模型配置文件；示例参见model-config.ini

### 集成zeroclaw;

最终打造成为一个界面可配置的便捷claw；
