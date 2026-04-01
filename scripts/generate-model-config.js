#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

const MYCHAT_DIR = path.join(os.homedir(), '.mychat');
const MODELS_DIR = path.join(MYCHAT_DIR, 'models', 'gguf');
const CONFIG_FILE = path.join(MYCHAT_DIR, 'gguf', 'model-config.ini');
const LOGS_DIR = path.join(MYCHAT_DIR, 'logs');

const DEFAULT_MODEL_CONFIG = {
  contextSize: 32768,
  temperature: 0.7,
  topP: 0.95,
  topK: 40,
  minP: 0.01,
  repeatPenalty: 1.0,
  cpuMoe: true,
};

function ensureDirs() {
  [MYCHAT_DIR, MODELS_DIR, path.dirname(CONFIG_FILE), LOGS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

function parseModelName(filename) {
  const name = filename.replace(/\.gguf$/i, '');
  const parts = name.split('-');
  
  let modelName = '';
  let quant = '';
  
  const quantPatterns = ['Q4_K_M', 'Q4_K_S', 'Q4_K_XL', 'Q4_0', 'Q4_1', 
                         'Q5_K_M', 'Q5_K_S', 'Q5_0', 'Q5_1',
                         'Q6_K', 'Q8_0', 'Q8_1',
                         'UD-Q4_K_XL', 'UD-Q5_K_XL', 'UD-Q3_K_XL',
                         'BF16', 'F16', 'F32'];
  
  for (const q of quantPatterns) {
    if (name.includes(q)) {
      quant = q;
      modelName = name.replace(q, '').replace(/[-_]+$/, '').replace(/^[-_]+/, '');
      break;
    }
  }
  
  if (!modelName) {
    modelName = name;
  }
  
  const alias = modelName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  
  return { modelName, quant, alias };
}

function estimateContextSize(filename) {
  const name = filename.toLowerCase();
  
  if (name.includes('0.6b') || name.includes('0.8b') || name.includes('1b')) {
    return 32768;
  } else if (name.includes('3b') || name.includes('7b') || name.includes('8b')) {
    return 32768;
  } else if (name.includes('14b') || name.includes('20b') || name.includes('30b') || name.includes('35b')) {
    return 32768;
  } else if (name.includes('70b') || name.includes('72b')) {
    return 16384;
  } else if (name.includes('math') || name.includes('reason')) {
    return 131072;
  }
  
  return 32768;
}

function generateModelConfig(modelPath, filename, options = {}) {
  const { modelName, quant, alias } = parseModelName(filename);
  const contextSize = options.contextSize || estimateContextSize(filename);
  const configName = `conf-${alias}`;
  
  const config = {
    model: modelPath,
    alias: alias,
    'cpu-moe': 'true',
    'ctx-size': contextSize.toString(),
    temp: (options.temperature || DEFAULT_MODEL_CONFIG.temperature).toString(),
    'top-p': (options.topP || DEFAULT_MODEL_CONFIG.topP).toString(),
    'top-k': (options.topK || DEFAULT_MODEL_CONFIG.topK).toString(),
    'min-p': (options.minP || DEFAULT_MODEL_CONFIG.minP).toString(),
  };
  
  if (options.repeatPenalty) {
    config['repeat-penalty'] = options.repeatPenalty.toString();
  }
  
  if (options.enableThinking === false) {
    config['chat-template-kwargs'] = '{"enable_thinking": false}';
  }
  
  return { configName, config, alias };
}

function generateConfigFile(models, options = {}) {
  const lines = [
    '; MyChat 模型池配置文件',
    `; 生成时间: ${new Date().toISOString()}`,
    `; 模型数量: ${models.length}`,
    '; ',
    '; 使用方法:',
    '; llama-server --models-preset ~/.mychat/gguf/model-config.ini --models-dir ~/.mychat/models/gguf --models-max 2',
    '',
  ];
  
  models.forEach(({ path: modelPath, filename, config: customConfig }) => {
    const { configName, config, alias } = generateModelConfig(modelPath, filename, customConfig || {});
    
    lines.push(`; 模型: ${filename}`);
    lines.push(`[${configName}]`);
    
    Object.entries(config).forEach(([key, value]) => {
      lines.push(`${key} = ${value}`);
    });
    
    lines.push('');
  });
  
  return lines.join('\n');
}

function scanModelsDir() {
  ensureDirs();
  
  const models = [];
  
  if (fs.existsSync(MODELS_DIR)) {
    const files = fs.readdirSync(MODELS_DIR);
    files.forEach(file => {
      if (file.endsWith('.gguf')) {
        const filePath = path.join(MODELS_DIR, file);
        const stats = fs.statSync(filePath);
        models.push({
          path: filePath,
          filename: file,
          size: stats.size,
        });
      }
    });
  }
  
  return models;
}

function scanDefaultModel() {
  const defaultModelDir = path.join(__dirname, '..', 'default-model');
  const models = [];
  
  if (fs.existsSync(defaultModelDir)) {
    const files = fs.readdirSync(defaultModelDir);
    files.forEach(file => {
      if (file.endsWith('.gguf')) {
        const filePath = path.join(defaultModelDir, file);
        const stats = fs.statSync(filePath);
        models.push({
          path: filePath,
          filename: file,
          size: stats.size,
          isDefault: true,
        });
      }
    });
  }
  
  return models;
}

function getAllModels() {
  const modelsDir = scanModelsDir();
  const defaultModels = scanDefaultModel();
  
  const allModels = [...defaultModels];
  
  modelsDir.forEach(model => {
    const exists = allModels.some(m => m.filename === model.filename);
    if (!exists) {
      allModels.push(model);
    }
  });
  
  return allModels.sort((a, b) => {
    if (a.isDefault && !b.isDefault) return -1;
    if (!a.isDefault && b.isDefault) return 1;
    return a.filename.localeCompare(b.filename);
  });
}

function generateAndSave(options = {}) {
  const models = getAllModels();
  
  if (models.length === 0) {
    console.log('⚠️ 未找到任何模型文件');
    console.log('');
    console.log('请将模型文件 (.gguf) 放入以下目录:');
    console.log(`  ${MODELS_DIR}`);
    console.log('');
    console.log('或下载默认模型:');
    console.log('  npm run model:download');
    return null;
  }
  
  console.log(`📦 找到 ${models.length} 个模型:`);
  models.forEach((m, i) => {
    const sizeMB = (m.size / 1024 / 1024).toFixed(1);
    const defaultTag = m.isDefault ? ' [默认]' : '';
    console.log(`  ${i + 1}. ${m.filename} (${sizeMB} MB)${defaultTag}`);
  });
  console.log('');
  
  const configContent = generateConfigFile(models, options);
  
  ensureDirs();
  fs.writeFileSync(CONFIG_FILE, configContent);
  
  console.log('✅ 模型配置文件已生成:');
  console.log(`  ${CONFIG_FILE}`);
  console.log('');
  console.log('🚀 启动命令:');
  console.log('  llama-server \\');
  console.log('    --models-preset ~/.mychat/gguf/model-config.ini \\');
  console.log('    --models-dir ~/.mychat/models/gguf \\');
  console.log('    --models-max 2 \\');
  console.log('    --jinja \\');
  console.log('    --host 0.0.0.0 \\');
  console.log('    --port 8080 \\');
  console.log('    --log-file ~/.mychat/logs/llama_server.log');
  
  return CONFIG_FILE;
}

function showStatus() {
  console.log('');
  console.log('📋 模型池状态');
  console.log('='.repeat(50));
  
  const models = getAllModels();
  
  if (models.length === 0) {
    console.log('⚠️ 未找到任何模型');
  } else {
    console.log(`模型数量: ${models.length}`);
    console.log('');
    models.forEach((m, i) => {
      const sizeMB = (m.size / 1024 / 1024).toFixed(1);
      const defaultTag = m.isDefault ? ' [默认]' : '';
      console.log(`  ${i + 1}. ${m.filename}`);
      console.log(`     路径: ${m.path}`);
      console.log(`     大小: ${sizeMB} MB${defaultTag}`);
    });
  }
  
  console.log('');
  console.log('配置文件: ' + (fs.existsSync(CONFIG_FILE) ? CONFIG_FILE : '未生成'));
  console.log('='.repeat(50));
}

function getConfigPath() {
  return CONFIG_FILE;
}

function getModelsDir() {
  return MODELS_DIR;
}

function getLogsDir() {
  return LOGS_DIR;
}

module.exports = {
  generateAndSave,
  showStatus,
  getAllModels,
  getConfigPath,
  getModelsDir,
  getLogsDir,
  ensureDirs,
};

if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args[0] === 'status' || args[0] === 'check') {
    showStatus();
  } else if (args[0] === 'generate') {
    generateAndSave();
  } else {
    generateAndSave();
  }
}
