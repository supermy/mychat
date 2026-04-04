const { app, BrowserWindow, ipcMain, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn, execSync } = require('child_process');

let mainWindow;
let engineProcess = null;
let enginePort = 8080;
let currentEngine = null;

const isDev = process.env.NODE_ENV === 'development' || (process.env.NODE_ENV !== 'production' && !app.isPackaged);

function findSystemBinary(binaryName) {
  try {
    if (process.platform === 'win32') {
      const result = execSync(`where ${binaryName} 2>nul`, { encoding: 'utf-8' });
      return result.trim().split('\n')[0];
    } else {
      const result = execSync(`which ${binaryName} 2>/dev/null`, { encoding: 'utf-8' });
      return result.trim();
    }
  } catch (e) {
    return null;
  }
}

function getEngineBinaryPath(engine) {
  const platform = process.platform;
  const arch = process.arch;
  
  let binaryName;
  if (engine === 'llama') {
    if (platform === 'win32') {
      binaryName = 'llama-server.exe';
    } else {
      binaryName = 'llama-server';
    }
  } else if (engine === 'zeroclaw') {
    if (platform === 'win32') {
      binaryName = 'zeroclaw.exe';
    } else {
      binaryName = 'zeroclaw';
    }
  } else {
    return null;
  }
  
  if (isDev) {
    return path.join(__dirname, '..', 'engine-binaries', engine, platform, binaryName);
  }
  
  return path.join(process.resourcesPath, 'engine-binaries', binaryName);
}

function getModelsDir() {
  const homeDir = app.getPath('home');
  return path.join(homeDir, '.mychat', 'models');
}

function getGgufModelsDir() {
  const homeDir = app.getPath('home');
  return path.join(homeDir, '.mychat', 'models', 'gguf');
}

function getModelConfigPath() {
  const homeDir = app.getPath('home');
  return path.join(homeDir, '.mychat', 'gguf', 'model-config.ini');
}

function getLogsDir() {
  const homeDir = app.getPath('home');
  return path.join(homeDir, '.mychat', 'logs');
}

function getDefaultModelPath() {
  const defaultModelName = 'Qwen3.5-0.8B-UD-Q4_K_XL.gguf';
  
  if (isDev) {
    return path.join(__dirname, '..', 'default-model', defaultModelName);
  }
  
  return path.join(process.resourcesPath, 'default-model', defaultModelName);
}

function getConfigPath(modelName) {
  const homeDir = app.getPath('home');
  const configDir = path.join(homeDir, '.mychat', 'configs');
  
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  if (modelName) {
    const safeName = modelName.replace(/[^a-zA-Z0-9.-]/g, '_');
    return path.join(configDir, `${safeName}.json`);
  }
  
  return path.join(homeDir, '.mychat', 'config.json');
}

function ensureDirs() {
  const modelsDir = getModelsDir();
  if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true });
  }
  
  const configDir = path.dirname(getConfigPath());
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
}

function getSystemMemory() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  return {
    total: totalMem,
    free: freeMem,
    totalGB: Math.round(totalMem / (1024 * 1024 * 1024)),
    freeGB: Math.round(freeMem / (1024 * 1024 * 1024)),
    hasGpu: false,
    vram: 0
  };
}

function getSystemInfo() {
  const platform = process.platform;
  const arch = process.arch;
  const cpuCores = os.cpus().length;
  const cpuModel = os.cpus()[0]?.model || 'Unknown';
  
  let gpuInfo = { hasGpu: false, vendor: '', model: '', vram: 0 };
  
  if (platform === 'darwin') {
    try {
      const result = execSync('system_profiler SPDisplaysDataType 2>/dev/null', { encoding: 'utf-8', timeout: 5000 });
      const lines = result.split('\n');
      let currentChipset = '';
      let currentVendor = '';
      let currentVRAM = 0;
      
      for (const line of lines) {
        if (line.includes('Chipset Model:')) {
          currentChipset = line.split(':')[1].trim();
        }
        if (line.includes('Vendor:')) {
          currentVendor = line.split(':')[1].trim();
        }
        if (line.includes('VRAM (Total):')) {
          const vramStr = line.split(':')[1].trim();
          currentVRAM = parseInt(vramStr) || 0;
        }
        if (line.includes('Metal: Supported') || line.includes('Metal 3')) {
          if (currentChipset && !currentChipset.includes('Intel')) {
            gpuInfo.hasGpu = true;
            gpuInfo.vendor = currentVendor || 'Apple';
            gpuInfo.model = currentChipset;
            gpuInfo.vram = currentVRAM;
          }
        }
      }
      
      if (result.includes('Apple M') || result.includes('Apple Silicon')) {
        gpuInfo.hasGpu = true;
        gpuInfo.vendor = 'Apple';
        gpuInfo.model = 'Apple Silicon GPU';
        gpuInfo.vram = Math.round(freeMem / (1024 * 1024 * 1024));
      }
    } catch (e) {
      console.log('Failed to get GPU info:', e.message);
    }
  } else if (platform === 'win32') {
    try {
      const result = execSync('wmic path win32_VideoController get name,AdapterRAM 2>nul', { encoding: 'utf-8', timeout: 5000 });
      const lines = result.split('\n').filter(l => l.trim());
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].trim().split(/\s+/);
        const name = parts.slice(0, -1).join(' ');
        const vram = parseInt(parts[parts.length - 1]) || 0;
        
        if (name.toLowerCase().includes('nvidia') || name.toLowerCase().includes('amd') || name.toLowerCase().includes('radeon')) {
          gpuInfo.hasGpu = true;
          gpuInfo.vendor = name.toLowerCase().includes('nvidia') ? 'NVIDIA' : 'AMD';
          gpuInfo.model = name;
          gpuInfo.vram = Math.round(vram / (1024 * 1024 * 1024));
          break;
        }
      }
    } catch (e) {
      console.log('Failed to get GPU info:', e.message);
    }
  } else if (platform === 'linux') {
    try {
      const result = execSync('lspci 2>/dev/null | grep -i vga', { encoding: 'utf-8', timeout: 5000 });
      if (result.toLowerCase().includes('nvidia')) {
        gpuInfo.hasGpu = true;
        gpuInfo.vendor = 'NVIDIA';
        gpuInfo.model = result.split(':')[2]?.trim() || 'NVIDIA GPU';
      } else if (result.toLowerCase().includes('amd') || result.toLowerCase().includes('radeon')) {
        gpuInfo.hasGpu = true;
        gpuInfo.vendor = 'AMD';
        gpuInfo.model = result.split(':')[2]?.trim() || 'AMD GPU';
      }
    } catch (e) {
      console.log('Failed to get GPU info:', e.message);
    }
  }
  
  return {
    platform,
    arch,
    cpuCores,
    cpuModel,
    gpuInfo
  };
}

function checkEngineCompatibility(enginePath, systemInfo) {
  try {
    const result = execSync(`file "${enginePath}" 2>/dev/null`, { encoding: 'utf-8', timeout: 5000 });
    const engineArch = result.includes('arm64') ? 'arm64' : 
                       result.includes('x86_64') ? 'x64' : 
                       result.includes('x64') ? 'x64' : 'unknown';
    
    const systemArch = systemInfo.arch === 'x64' ? 'x64' : systemInfo.arch;
    
    return {
      compatible: engineArch === systemArch || engineArch === 'unknown',
      engineArch,
      systemArch,
      message: engineArch !== systemArch ? 
        `引擎架构 (${engineArch}) 与系统架构 (${systemArch}) 不匹配` : 
        '架构匹配'
    };
  } catch (e) {
    return { compatible: true, engineArch: 'unknown', systemArch: systemInfo.arch, message: '无法检测架构' };
  }
}

function sendLog(message, type = 'info') {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('engine-log', { message, type, timestamp: Date.now() });
  }
}

function parseEngineLogType(message, defaultType = 'info') {
  const lowerMsg = message.toLowerCase();
  
  if (lowerMsg.includes('error') && !lowerMsg.includes('0 error') && !lowerMsg.includes('no error')) {
    if (lowerMsg.includes('failed') || lowerMsg.includes('cannot') || lowerMsg.includes('unable') || lowerMsg.includes('fatal')) {
      return 'error';
    }
  }
  
  if (lowerMsg.includes('warning') || lowerMsg.includes('warn:')) {
    return 'warning';
  }
  
  if (lowerMsg.includes('success') || lowerMsg.includes('loaded') || lowerMsg.includes('listening') || lowerMsg.includes('started')) {
    return 'success';
  }
  
  if (lowerMsg.includes('error]') || lowerMsg.match(/^\s*\[error\]/i)) {
    return 'info';
  }
  
  return defaultType;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false,
      allowRunningInsecureContent: true,
      webviewTag: true,
    },
    titleBarStyle: 'hiddenInset',
    show: false
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:8081');
    mainWindow.webContents.openDevTools();
  } else {
    const distPath = path.join(__dirname, '..', 'dist');
    const htmlPath = path.join(distPath, 'index.html');
    const fixedHtmlPath = path.join(distPath, 'index-fixed.html');
    
    let html = fs.readFileSync(htmlPath, 'utf-8');
    html = html.replace(/src="\/_expo\//g, 'src="_expo/');
    html = html.replace(/href="\/favicon/g, 'href="favicon');
    
    fs.writeFileSync(fixedHtmlPath, html);
    mainWindow.loadFile(fixedHtmlPath);
  }
}

function startEngine(engine, config) {
  return new Promise((resolve, reject) => {
    if (engineProcess) {
      sendLog('正在停止现有引擎...', 'info');
      engineProcess.kill();
      engineProcess = null;
    }

    const binaryPath = getEngineBinaryPath(engine);
    const actualPort = config.port || 11434;
    
    if (!binaryPath || !fs.existsSync(binaryPath)) {
      sendLog(`${engine} 二进制文件未找到，将使用外部 API`, 'warning');
      console.log(`${engine} binary not found, will use external API`);
      enginePort = actualPort;
      resolve({ success: true, port: actualPort, external: true });
      return;
    }

    sendLog(`启动引擎: ${engine}`, 'info');
    sendLog(`模型路径: ${config.modelPath}`, 'info');
    sendLog(`端口: ${actualPort}`, 'info');

    let args;
    if (engine === 'llama') {
      args = [
        '-m', config.modelPath,
        '--host', config.host || '0.0.0.0',
        '--port', actualPort.toString(),
        '-c', (config.contextSize || 32768).toString(),
        '-n', (config.numPredict || 16384).toString(),
        '-b', (config.batchSize || 7021).toString(),
        '--n-gpu-layers', (config.gpuLayers ?? -1).toString(),
        '--threads', (config.threads || 4).toString(),
        '-np', (config.parallel || 1).toString(),
        '--temp', (config.temperature ?? 0.6).toString(),
        '--top-p', (config.topP ?? 0.95).toString(),
        '--top-k', (config.topK || 20).toString(),
        '--min-p', (config.minP ?? 0.0).toFixed(1),
        '--repeat-penalty', (config.repeatPenalty ?? 1.0).toFixed(1),
        '--presence-penalty', (config.presencePenalty ?? 0.0).toFixed(1),
      ];
      
      if (config.flashAttention) {
        args.push('-fa', 'on');
      }
      
      args.push('-fit', 'on');
      
      if (config.cacheTypeV) {
        args.push('--cache-type-v', config.cacheTypeV);
      }
      
      args.push('--chat-template-kwargs', JSON.stringify({"enable_thinking": config.enableThinking ?? true}));
      
      args.push('--cont-batching', '--metrics');
    } else if (engine === 'zeroclaw') {
      args = [
        '--model', config.modelPath,
        '--host', '127.0.0.1',
        '--port', (config.port || enginePort).toString(),
        '--ctx-size', (config.contextSize || 4096).toString(),
      ];
    }

    sendLog(`启动参数: ${args.join(' ')}`, 'info');
    
    const engineDir = path.dirname(binaryPath);
    engineProcess = spawn(binaryPath, args, { cwd: engineDir });
    currentEngine = engine;
    
    let resolved = false;

    engineProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`[${engine}]`, output);
      sendLog(output.trim(), 'stdout');
      
      if (!resolved && (output.includes('server is listening') || output.includes('HTTP server listening') || output.includes('Server started'))) {
        resolved = true;
        enginePort = actualPort;
        sendLog('引擎启动成功!', 'success');
        resolve({ success: true, port: actualPort, engine });
      }
    });

    engineProcess.stderr.on('data', (data) => {
      const output = data.toString();
      console.error(`[${engine} stderr]`, output);
      const logType = parseEngineLogType(output, 'info');
      sendLog(output.trim(), logType);
      
      if (!resolved && (output.includes('server is listening') || output.includes('HTTP server listening') || output.includes('Server started'))) {
        resolved = true;
        enginePort = actualPort;
        sendLog('引擎启动成功!', 'success');
        resolve({ success: true, port: actualPort, engine });
      }
    });

    engineProcess.on('error', (err) => {
      console.error(`Failed to start ${engine}:`, err);
      sendLog(`启动失败: ${err.message}`, 'error');
      if (!resolved) {
        resolve({ success: false, port: config.port || enginePort, external: true });
      }
    });

    engineProcess.on('close', (code) => {
      console.log(`${engine} exited with code ${code}`);
      sendLog(`引擎已退出 (代码: ${code})`, code === 0 ? 'info' : 'warning');
      engineProcess = null;
      currentEngine = null;
    });

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        enginePort = actualPort;
        sendLog('引擎启动超时，假设已启动', 'warning');
        resolve({ success: true, port: actualPort, engine });
      }
    }, 10000);
  });
}

function stopEngine() {
  return new Promise((resolve) => {
    if (engineProcess) {
      sendLog('正在停止引擎...', 'info');
      engineProcess.on('close', () => {
        sendLog('引擎已停止', 'info');
        resolve();
      });
      engineProcess.kill();
      engineProcess = null;
      currentEngine = null;
    } else {
      resolve();
    }
  });
}

function startModelPool(config) {
  return new Promise((resolve, reject) => {
    if (engineProcess) {
      sendLog('正在停止现有引擎...', 'info');
      engineProcess.kill();
      engineProcess = null;
    }

    const binaryPath = getEngineBinaryPath('llama');
    const actualPort = config.port || 8080;
    
    if (!binaryPath || !fs.existsSync(binaryPath)) {
      sendLog('llama-server 二进制文件未找到', 'error');
      resolve({ success: false, message: 'llama-server 未安装' });
      return;
    }

    const modelsDir = getGgufModelsDir();
    const configPath = getModelConfigPath();
    const logsDir = getLogsDir();
    
    if (!fs.existsSync(modelsDir)) {
      fs.mkdirSync(modelsDir, { recursive: true });
    }
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    if (!fs.existsSync(path.dirname(configPath))) {
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
    }

    if (!fs.existsSync(configPath)) {
      sendLog('模型配置文件不存在，请先生成配置', 'error');
      resolve({ success: false, message: '模型配置文件不存在' });
      return;
    }

    sendLog('启动模型池...', 'info');
    sendLog(`配置文件: ${configPath}`, 'info');
    sendLog(`模型目录: ${modelsDir}`, 'info');
    sendLog(`端口: ${actualPort}`, 'info');
    sendLog(`最大模型数: ${config.maxModels || 2}`, 'info');

    const args = [
      '--models-preset', configPath,
      '--models-dir', modelsDir,
      '--models-max', (config.maxModels || 2).toString(),
      '--jinja',
      '--host', config.host || '0.0.0.0',
      '--port', actualPort.toString(),
      '--log-file', path.join(logsDir, 'llama_server.log'),
    ];

    if (config.contextSize) {
      args.push('-c', config.contextSize.toString());
    }
    
    if (config.gpuLayers !== undefined) {
      args.push('--n-gpu-layers', config.gpuLayers.toString());
    }
    
    if (config.threads) {
      args.push('--threads', config.threads.toString());
    }

    sendLog(`启动参数: ${args.join(' ')}`, 'info');
    
    const engineDir = path.dirname(binaryPath);
    engineProcess = spawn(binaryPath, args, { cwd: engineDir });
    currentEngine = 'llama-pool';
    enginePort = actualPort;
    
    let resolved = false;

    engineProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('[llama-pool]', output);
      sendLog(output.trim(), 'stdout');
      
      if (!resolved && output.includes('server is listening')) {
        resolved = true;
        sendLog('模型池启动成功!', 'success');
        resolve({ success: true, port: actualPort, engine: 'llama-pool' });
      }
    });

    engineProcess.stderr.on('data', (data) => {
      const output = data.toString();
      console.error('[llama-pool stderr]', output);
      const logType = parseEngineLogType(output, 'info');
      sendLog(output.trim(), logType);
      
      if (!resolved && (output.includes('server is listening') || output.includes('router server is listening'))) {
        resolved = true;
        sendLog('模型池启动成功!', 'success');
        resolve({ success: true, port: actualPort, engine: 'llama-pool' });
      }
    });

    engineProcess.on('error', (err) => {
      console.error('Failed to start model pool:', err);
      sendLog(`启动失败: ${err.message}`, 'error');
      if (!resolved) {
        resolve({ success: false, message: err.message });
      }
    });

    engineProcess.on('close', (code) => {
      console.log(`Model pool exited with code ${code}`);
      sendLog(`模型池已退出 (代码: ${code})`, code === 0 ? 'info' : 'warning');
      engineProcess = null;
      currentEngine = null;
      enginePort = 0;
    });

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        sendLog('模型池启动超时，假设已启动', 'warning');
        resolve({ success: true, port: actualPort, engine: 'llama-pool' });
      }
    }, 15000);
  });
}

function generateModelConfig() {
  return new Promise((resolve, reject) => {
    const generateScript = path.join(__dirname, '..', 'scripts', 'generate-model-config.js');
    
    if (!fs.existsSync(generateScript)) {
      resolve({ success: false, message: '配置生成脚本不存在' });
      return;
    }
    
    const child = spawn('node', [generateScript], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env }
    });
    
    let output = '';
    
    child.stdout.on('data', (data) => {
      output += data.toString();
      console.log('[config-gen]', data.toString());
    });
    
    child.stderr.on('data', (data) => {
      output += data.toString();
      console.error('[config-gen error]', data.toString());
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, output });
      } else {
        resolve({ success: false, message: '配置生成失败', output });
      }
    });
    
    child.on('error', (err) => {
      resolve({ success: false, message: err.message });
    });
  });
}

app.whenReady().then(() => {
  ensureDirs();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  stopEngine();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopEngine();
});

// IPC Handlers

ipcMain.handle('get-system-memory', () => {
  return getSystemMemory();
});

ipcMain.handle('get-system-info', () => {
  return getSystemInfo();
});

ipcMain.handle('check-engine-compatibility', async (event, engine) => {
  const systemInfo = getSystemInfo();
  
  const binaryPath = getEngineBinaryPath(engine);
  
  if (!binaryPath || !fs.existsSync(binaryPath)) {
    return {
      installed: false,
      compatible: false,
      engineArch: 'none',
      systemArch: systemInfo.arch,
      message: '引擎未安装'
    };
  }
  
  return {
    installed: true,
    ...checkEngineCompatibility(binaryPath, systemInfo)
  };
});

ipcMain.handle('get-models-dir', () => {
  return getModelsDir();
});

ipcMain.handle('get-default-model', () => {
  const defaultModelPath = getDefaultModelPath();
  if (fs.existsSync(defaultModelPath)) {
    return {
      exists: true,
      name: path.basename(defaultModelPath),
      path: defaultModelPath,
      size: fs.statSync(defaultModelPath).size
    };
  }
  return { exists: false };
});

ipcMain.handle('list-models', () => {
  const modelsDir = getModelsDir();
  const models = [];
  
  // Add default model
  const defaultModelPath = getDefaultModelPath();
  if (fs.existsSync(defaultModelPath)) {
    models.push({
      name: path.basename(defaultModelPath),
      path: defaultModelPath,
      size: fs.statSync(defaultModelPath).size,
      isDefault: true
    });
  }
  
  // Add user models
  if (fs.existsSync(modelsDir)) {
    const userModels = fs.readdirSync(modelsDir)
      .filter(f => f.endsWith('.gguf'))
      .map(f => ({
        name: f,
        path: path.join(modelsDir, f),
        size: fs.statSync(path.join(modelsDir, f)).size,
        isDefault: false
      }));
    models.push(...userModels);
  }
  
  return models;
});

ipcMain.handle('get-engine-status', async (event, engine) => {
  const binaryPath = getEngineBinaryPath(engine);
  const installed = binaryPath && fs.existsSync(binaryPath);
  
  const { getCurrentVersion } = require('../scripts/download-engines.js');
  const engineDir = path.dirname(binaryPath);
  const version = installed ? getCurrentVersion(engineDir) : null;
  
  return {
    installed,
    path: binaryPath || '',
    version: version || ''
  };
});

ipcMain.handle('check-engine-update', async (event, engine) => {
  const { checkForUpdate } = require('../scripts/download-engines.js');
  return checkForUpdate(engine, process.platform, process.arch);
});

ipcMain.handle('download-engine-update', async (event, { engine, version }) => {
  const { downloadEngine } = require('../scripts/download-engines.js');
  
  return downloadEngine(engine, process.platform, process.arch, version, 
    (downloaded, total) => {
      event.sender.send('engine-download-progress', {
        engine,
        version,
        downloaded,
        total,
        progress: total ? (downloaded / total * 100).toFixed(1) : 0
      });
    },
    (logEntry) => {
      event.sender.send('engine-download-log', {
        engine,
        version,
        ...logEntry
      });
    }
  );
});

ipcMain.handle('start-engine', async (event, { engine, config }) => {
  return startEngine(engine, config);
});

ipcMain.handle('stop-engine', async () => {
  return stopEngine();
});

ipcMain.handle('start-model-pool', async (event, config) => {
  return startModelPool(config);
});

ipcMain.handle('generate-model-config', async () => {
  return generateModelConfig();
});

ipcMain.handle('get-model-config-path', () => {
  return getModelConfigPath();
});

ipcMain.handle('get-gguf-models-dir', () => {
  return getGgufModelsDir();
});

ipcMain.handle('read-file', async (event, filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return { success: true, content };
    } else {
      return { success: false, error: 'File not found' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('write-file', async (event, filePath, content) => {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-current-engine', () => {
  return {
    engine: currentEngine,
    running: engineProcess !== null,
    port: enginePort
  };
});

function getServicePlistPath() {
  const homeDir = app.getPath('home');
  return path.join(homeDir, 'Library', 'LaunchAgents', 'com.mychat.modelpool.plist');
}

function getServiceScriptPath() {
  const homeDir = app.getPath('home');
  return path.join(homeDir, '.mychat', 'scripts', 'start-model-pool.sh');
}

async function installModelPoolService(config) {
  const platform = process.platform;
  
  try {
    if (platform === 'darwin') {
      const homeDir = app.getPath('home');
      const plistPath = getServicePlistPath();
      const scriptPath = getServiceScriptPath();
      const logsDir = getLogsDir();
      const configPath = getModelConfigPath();
      const modelsDir = getGgufModelsDir();
      const binaryPath = getEngineBinaryPath('llama');
      
      if (!fs.existsSync(path.dirname(scriptPath))) {
        fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
      }
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      
      const startScript = `#!/bin/bash
# MyChat Model Pool Service
export PATH="/usr/local/bin:$PATH"

LOG_FILE="${path.join(logsDir, 'model-pool-service.log')}"
CONFIG_PATH="${configPath}"
MODELS_DIR="${modelsDir}"
BINARY_PATH="${binaryPath}"
PORT="${config.port || 8080}"
MAX_MODELS="${config.maxModels || 2}"
HOST="${config.host || '0.0.0.0'}"

echo "$(date): Starting Model Pool Service" >> "$LOG_FILE"
echo "$(date): Config: $CONFIG_PATH" >> "$LOG_FILE"
echo "$(date): Models Dir: $MODELS_DIR" >> "$LOG_FILE"
echo "$(date): Port: $PORT" >> "$LOG_FILE"

"$BINARY_PATH" \\
  --models-preset "$CONFIG_PATH" \\
  --models-dir "$MODELS_DIR" \\
  --models-max "$MAX_MODELS" \\
  --jinja \\
  --host "$HOST" \\
  --port "$PORT" \\
  --log-file "${path.join(logsDir, 'llama_server.log')}" \\
  >> "$LOG_FILE" 2>&1
`;
      
      fs.writeFileSync(scriptPath, startScript, { mode: 0o755 });
      
      const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.mychat.modelpool</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>${scriptPath}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <false/>
    <key>StandardOutPath</key>
    <string>${path.join(logsDir, 'model-pool-stdout.log')}</string>
    <key>StandardErrorPath</key>
    <string>${path.join(logsDir, 'model-pool-stderr.log')}</string>
    <key>WorkingDirectory</key>
    <string>${path.dirname(binaryPath)}</string>
</dict>
</plist>
`;
      
      fs.writeFileSync(plistPath, plistContent);
      
      const { execSync } = require('child_process');
      execSync(`launchctl load "${plistPath}"`, { stdio: 'pipe' });
      
      return { success: true, message: '服务已安装并启动' };
    } else if (platform === 'linux') {
      const homeDir = app.getPath('home');
      const servicePath = '/etc/systemd/system/mychat-modelpool.service';
      const scriptPath = path.join(homeDir, '.mychat', 'scripts', 'start-model-pool.sh');
      const logsDir = getLogsDir();
      const configPath = getModelConfigPath();
      const modelsDir = getGgufModelsDir();
      const binaryPath = getEngineBinaryPath('llama');
      
      if (!fs.existsSync(path.dirname(scriptPath))) {
        fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
      }
      
      const startScript = `#!/bin/bash
# MyChat Model Pool Service
LOG_FILE="${path.join(logsDir, 'model-pool-service.log')}"
CONFIG_PATH="${configPath}"
MODELS_DIR="${modelsDir}"
BINARY_PATH="${binaryPath}"
PORT="${config.port || 8080}"
MAX_MODELS="${config.maxModels || 2}"
HOST="${config.host || '0.0.0.0'}"

echo "$(date): Starting Model Pool Service" >> "$LOG_FILE"

"$BINARY_PATH" \\
  --models-preset "$CONFIG_PATH" \\
  --models-dir "$MODELS_DIR" \\
  --models-max "$MAX_MODELS" \\
  --jinja \\
  --host "$HOST" \\
  --port "$PORT" \\
  --log-file "${path.join(logsDir, 'llama_server.log')}" \\
  >> "$LOG_FILE" 2>&1
`;
      
      fs.writeFileSync(scriptPath, startScript, { mode: 0o755 });
      
      return { success: true, message: '服务脚本已创建，请使用 sudo 手动安装 systemd 服务' };
    } else if (platform === 'win32') {
      return { success: false, message: 'Windows 服务安装暂不支持，请手动配置' };
    }
    
    return { success: false, message: '不支持的操作系统' };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

async function uninstallModelPoolService() {
  const platform = process.platform;
  
  try {
    if (platform === 'darwin') {
      const plistPath = getServicePlistPath();
      
      if (fs.existsSync(plistPath)) {
        const { execSync } = require('child_process');
        try {
          execSync(`launchctl unload "${plistPath}"`, { stdio: 'pipe' });
        } catch (e) {
          // Ignore if not loaded
        }
        fs.unlinkSync(plistPath);
      }
      
      return { success: true, message: '服务已卸载' };
    } else if (platform === 'linux') {
      const servicePath = '/etc/systemd/system/mychat-modelpool.service';
      
      return { success: true, message: '请使用 sudo 手动卸载 systemd 服务' };
    }
    
    return { success: false, message: '不支持的操作系统' };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

ipcMain.handle('install-model-pool-service', async (event, config) => {
  return installModelPoolService(config);
});

ipcMain.handle('uninstall-model-pool-service', async () => {
  return uninstallModelPoolService();
});

const CONFIG_FILE = path.join(app.getPath('userData'), 'mychat-config.json');

ipcMain.handle('save-app-config', async (event, config) => {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    console.log('[Config] Saved to:', CONFIG_FILE);
    return { success: true };
  } catch (error) {
    console.error('[Config] Save error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-app-config', async () => {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      console.log('[Config] Loaded from:', CONFIG_FILE);
      return JSON.parse(data);
    }
    return null;
  } catch (error) {
    console.error('[Config] Load error:', error);
    return null;
  }
});

ipcMain.handle('probe-ssh-host', async (event, config) => {
  const { Client } = require('ssh2');
  const fs = require('fs');
  
  const result = {
    connected: false,
    timestamp: new Date().toLocaleString()
  };
  
  console.log('[SSH Probe] Starting probe for:', config.host);
  
  const conn = new Client();
  
  const connect = () => {
    return new Promise((resolve, reject) => {
      const connConfig = {
        host: config.host,
        port: config.port || 22,
        username: config.username,
        readyTimeout: 15000
      };
      
      if (config.useKey && config.keyPath) {
        const keyPath = config.keyPath.replace('~', process.env.HOME);
        try {
          connConfig.privateKey = fs.readFileSync(keyPath);
        } catch (e) {
          reject(new Error(`无法读取密钥文件: ${e.message}`));
          return;
        }
      } else if (config.password) {
        connConfig.password = config.password;
      } else {
        reject(new Error('请提供密码或密钥路径'));
        return;
      }
      
      conn.on('ready', () => {
        console.log('[SSH Probe] Connection successful');
        resolve();
      });
      
      conn.on('error', (err) => {
        console.log('[SSH Probe] Connection failed:', err.message);
        reject(err);
      });
      
      conn.connect(connConfig);
    });
  };
  
  const execCmd = (cmd) => {
    return new Promise((resolve) => {
      conn.exec(cmd, (err, stream) => {
        if (err) {
          console.log('[SSH Probe] Command failed:', cmd, err.message);
          resolve(null);
          return;
        }
        
        let output = '';
        stream.on('data', (data) => {
          output += data.toString();
        });
        stream.on('close', () => {
          resolve(output.trim());
        });
        stream.stderr.on('data', (data) => {
          console.log('[SSH Probe] stderr:', data.toString());
        });
      });
    });
  };
  
  try {
    await connect();
    result.connected = true;
    
    console.log('[SSH Probe] Gathering system info...');
    const sysInfo = await execCmd('hostname && uname -s && uname -r && uname -m');
    if (sysInfo) {
      const lines = sysInfo.split('\n');
      result.system = {
        hostname: lines[0] || 'unknown',
        os: lines[1] || 'unknown',
        kernel: lines[2] || 'unknown',
        arch: lines[3] || 'unknown'
      };
      console.log('[SSH Probe] System:', result.system);
    }
    
    console.log('[SSH Probe] Gathering CPU info...');
    const cpuInfo = await execCmd('cat /proc/cpuinfo 2>/dev/null || sysctl -n machdep.cpu.brand_string hw.ncpu 2>/dev/null');
    if (cpuInfo) {
      result.cpu = { model: 'unknown', cores: 0, threads: 0 };
      
      if (cpuInfo.includes('model name')) {
        const lines = cpuInfo.split('\n');
        for (const line of lines) {
          if (line.toLowerCase().startsWith('model name')) {
            const modelMatch = line.match(/model\s*name\s*:\s*(.+)/i);
            if (modelMatch) {
              result.cpu.model = modelMatch[1].trim();
              break;
            }
          }
        }
        
        let coresFound = 0;
        let threadsFound = 0;
        for (const line of lines) {
          if (line.toLowerCase().startsWith('cpu cores')) {
            const coresMatch = line.match(/cpu\s*cores\s*:\s*(\d+)/i);
            if (coresMatch) coresFound = parseInt(coresMatch[1]);
          }
          if (line.toLowerCase().startsWith('siblings')) {
            const siblingsMatch = line.match(/siblings\s*:\s*(\d+)/i);
            if (siblingsMatch) threadsFound = parseInt(siblingsMatch[1]);
          }
        }
        
        if (coresFound > 0) result.cpu.cores = coresFound;
        else {
          const coreCount = lines.filter(l => l.startsWith('processor')).length;
          result.cpu.cores = coreCount || 1;
        }
        
        if (threadsFound > 0) result.cpu.threads = threadsFound;
        else result.cpu.threads = result.cpu.cores;
        
      } else if (cpuInfo.includes('Model name') || cpuInfo.includes('brand_string')) {
        const lines = cpuInfo.split('\n');
        if (lines.length >= 1) result.cpu.model = lines[0].trim();
        if (lines.length >= 2) result.cpu.cores = parseInt(lines[1]) || 1;
        result.cpu.threads = result.cpu.cores;
      } else {
        const coreCount = await execCmd('nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null');
        if (coreCount) {
          result.cpu.cores = parseInt(coreCount.trim()) || 1;
          result.cpu.threads = result.cpu.cores;
        }
      }
      console.log('[SSH Probe] CPU:', result.cpu);
    }
    
    if (!result.cpu || result.cpu.model === 'unknown') {
      const lscpu = await execCmd('lscpu 2>/dev/null');
      if (lscpu) {
        if (!result.cpu) result.cpu = { model: 'unknown', cores: 0, threads: 0 };
        
        const modelMatch = lscpu.match(/Model name:\s*(.+)/i);
        if (modelMatch) result.cpu.model = modelMatch[1].trim();
        
        const coresMatch = lscpu.match(/Core\(s\) per socket:\s*(\d+)/i);
        const socketsMatch = lscpu.match(/Socket\(s\):\s*(\d+)/i);
        const threadsMatch = lscpu.match(/Thread\(s\) per core:\s*(\d+)/i);
        
        if (coresMatch && socketsMatch) {
          result.cpu.cores = parseInt(coresMatch[1]) * parseInt(socketsMatch[1]);
        }
        if (threadsMatch && result.cpu.cores > 0) {
          result.cpu.threads = result.cpu.cores * parseInt(threadsMatch[1]);
        }
        
        console.log('[SSH Probe] CPU (from lscpu):', result.cpu);
      }
    }
    
    if (!result.cpu) {
      result.cpu = { model: 'unknown', cores: 0, threads: 0 };
    }
    
    console.log('[SSH Probe] Gathering memory info...');
    const memInfo = await execCmd('free -b 2>/dev/null || vm_stat 2>/dev/null');
    if (memInfo) {
      result.memory = { total: 0, used: 0, available: 0 };
      
      if (memInfo.includes('Mem:')) {
        const memLine = memInfo.split('\n').find(l => l.startsWith('Mem:'));
        if (memLine) {
          const parts = memLine.split(/\s+/);
          result.memory.total = parseInt(parts[1]) || 0;
          result.memory.used = parseInt(parts[2]) || 0;
          result.memory.available = parseInt(parts[6]) || parseInt(parts[3]) || 0;
        }
      } else {
        const pageSize = 4096;
        const totalMatch = memInfo.match(/Pages free:\s+(\d+)/);
        const activeMatch = memInfo.match(/Pages active:\s+(\d+)/);
        const inactiveMatch = memInfo.match(/Pages inactive:\s+(\d+)/);
        const wiredMatch = memInfo.match(/Pages wired down:\s+(\d+)/);
        
        if (totalMatch) {
          const free = parseInt(totalMatch[1]) * pageSize;
          const active = activeMatch ? parseInt(activeMatch[1]) * pageSize : 0;
          const inactive = inactiveMatch ? parseInt(inactiveMatch[1]) * pageSize : 0;
          const wired = wiredMatch ? parseInt(wiredMatch[1]) * pageSize : 0;
          
          result.memory.total = free + active + inactive + wired;
          result.memory.available = free + inactive;
          result.memory.used = active + wired;
        }
      }
      console.log('[SSH Probe] Memory:', result.memory);
    }
    
    if (!result.memory) {
      result.memory = { total: 0, used: 0, available: 0 };
    }
    
    console.log('[SSH Probe] Gathering GPU info...');
    let gpuFound = false;
    
    const nvidiaSmi = await execCmd('nvidia-smi --query-gpu=name,memory.total --format=csv,noheader 2>/dev/null');
    if (nvidiaSmi && !nvidiaSmi.includes('command not found') && nvidiaSmi.trim().length > 0) {
      result.gpu = { available: true, vendor: 'NVIDIA', devices: [] };
      const gpuLines = nvidiaSmi.split('\n').filter(l => l.trim() && l.includes(','));
      
      for (const line of gpuLines) {
        const parts = line.split(',');
        if (parts.length >= 2) {
          const name = parts[0]?.trim() || 'Unknown GPU';
          const memStr = parts[1]?.trim() || '0';
          const memMatch = memStr.match(/(\d+)/);
          const memory = memMatch ? parseInt(memMatch[1]) * 1024 * 1024 : 0;
          result.gpu.devices.push({ name, memory });
        }
      }
      
      if (result.gpu.devices.length > 0) {
        gpuFound = true;
        console.log('[SSH Probe] GPU (nvidia-smi):', result.gpu);
      }
    }
    
    if (!gpuFound) {
      const amdGpu = await execCmd('lspci 2>/dev/null | grep -i vga');
      if (amdGpu && amdGpu.trim().length > 0) {
        const isNvidia = amdGpu.toLowerCase().includes('nvidia');
        const isAmd = amdGpu.toLowerCase().includes('amd') || amdGpu.toLowerCase().includes('radeon');
        result.gpu = { 
          available: true, 
          vendor: isNvidia ? 'NVIDIA' : (isAmd ? 'AMD' : 'Unknown'),
          devices: [] 
        };
        const lines = amdGpu.split('\n').filter(l => l.trim());
        
        for (const line of lines) {
          const match = line.match(/VGA compatible controller:\s*(.+)/i);
          if (match) {
            result.gpu.devices.push({ name: match[1].trim(), memory: 0 });
          } else if (line.includes('VGA')) {
            const parts = line.split(':');
            const name = parts[parts.length - 1]?.trim() || 'Unknown GPU';
            result.gpu.devices.push({ name, memory: 0 });
          }
        }
        
        if (result.gpu.devices.length > 0) {
          gpuFound = true;
          console.log('[SSH Probe] GPU (lspci):', result.gpu);
        }
      }
    }
    
    if (!gpuFound) {
      const macGpu = await execCmd('system_profiler SPDisplaysDataType 2>/dev/null');
      if (macGpu && (macGpu.includes('Chipset') || macGpu.includes('VRAM'))) {
        result.gpu = { available: false, devices: [] };
        const lines = macGpu.split('\n');
        let currentDevice = { name: 'Unknown', memory: 0 };
        
        for (const line of lines) {
          if (line.includes('Chipset Model:')) {
            currentDevice.name = line.split(':')[1]?.trim() || 'Unknown';
          } else if (line.includes('VRAM')) {
            const vramMatch = line.match(/(\d+)/);
            if (vramMatch) {
              currentDevice.memory = parseInt(vramMatch[1]) * 1024 * 1024;
            }
            if (currentDevice.name !== 'Unknown') {
              result.gpu.devices.push({...currentDevice});
              currentDevice = { name: 'Unknown', memory: 0 };
            }
          }
        }
        
        if (result.gpu.devices.length > 0) {
          result.gpu.available = true;
          gpuFound = true;
          console.log('[SSH Probe] GPU (macOS):', result.gpu);
        }
      }
    }
    
    if (!result.gpu) {
      result.gpu = { available: false, devices: [] };
    }
    
    console.log('[SSH Probe] Gathering disk info...');
    const diskInfo = await execCmd('df -B1 2>/dev/null || df -k 2>/dev/null');
    if (diskInfo) {
      result.disks = [];
      const lines = diskInfo.split('\n');
      let multiplier = 1;
      
      if (diskInfo.includes(' -k ')) {
        multiplier = 1024;
      }
      
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(/\s+/);
        if (parts.length >= 6) {
          const filesystem = parts[0];
          const total = (parseInt(parts[1]) || 0) * multiplier;
          const used = (parseInt(parts[2]) || 0) * multiplier;
          const available = (parseInt(parts[3]) || 0) * multiplier;
          const path = parts[5];
          
          if (path && !path.startsWith('/dev') && !path.startsWith('/sys') && 
              !path.startsWith('/proc') && !path.startsWith('/run') && 
              !path.startsWith('/snap') && available > 0) {
            result.disks.push({
              filesystem,
              total,
              used,
              available,
              path,
              usePercent: parts[4] || '0%'
            });
          }
        }
      }
      
      result.disks.sort((a, b) => b.available - a.available);
      
      if (result.disks.length > 0) {
        result.disk = {
          total: result.disks[0].total,
          used: result.disks[0].used,
          available: result.disks[0].available,
          path: result.disks[0].path
        };
      }
      
      console.log('[SSH Probe] Disks:', result.disks.length, 'disks found');
    }
    
    if (!result.disks || result.disks.length === 0) {
      result.disks = [];
      result.disk = { total: 0, used: 0, available: 0, path: '~' };
    }
    
    console.log('[SSH Probe] Listing model files...');
    let modelsPath = config.modelsPath || '~/.mychat/models/gguf';
    
    const expandedPath = await execCmd(`echo "${modelsPath}"`);
    if (expandedPath) {
      modelsPath = expandedPath.trim();
    }
    
    console.log('[SSH Probe] Models path:', modelsPath);
    
    const modelFilesOutput = await execCmd(`ls -lh "${modelsPath}"/*.gguf 2>/dev/null || echo "NO_MODELS"`);
    console.log('[SSH Probe] ls output:', modelFilesOutput ? modelFilesOutput.substring(0, 500) : 'null');
    
    if (modelFilesOutput && modelFilesOutput !== 'NO_MODELS') {
      result.models = [];
      const lines = modelFilesOutput.split('\n');
      for (const line of lines) {
        if (line.trim() && !line.startsWith('total')) {
          const parts = line.split(/\s+/);
          if (parts.length >= 9) {
            const size = parts[4];
            const filename = parts[parts.length - 1];
            const datePart = parts[5];
            const dayOrTime = parts[6];
            const yearOrTime = parts[7];
            
            let modifiedTime = '';
            if (yearOrTime && yearOrTime.includes(':')) {
              modifiedTime = `${datePart} ${dayOrTime} ${yearOrTime}`;
            } else if (yearOrTime) {
              modifiedTime = `${datePart} ${dayOrTime} ${yearOrTime}`;
            } else {
              modifiedTime = `${datePart} ${dayOrTime}`;
            }
            
            if (filename && filename.endsWith('.gguf')) {
              result.models.push({
                name: filename,
                size: size,
                modifiedTime: modifiedTime,
                path: `${modelsPath}/${filename}`
              });
            }
          }
        }
      }
      result.models.sort((a, b) => a.name.localeCompare(b.name));
      console.log('[SSH Probe] Models found:', result.models.length);
    } else {
      result.models = [];
      console.log('[SSH Probe] No models found in', modelsPath);
    }
    
    console.log('[SSH Probe] Probe completed successfully');
    
  } catch (error) {
    result.connected = false;
    result.error = error.message;
    console.log('[SSH Probe] Error:', error.message);
  } finally {
    conn.end();
  }
  
  return result;
});

ipcMain.handle('execute-ssh-command', async (event, { config, command }) => {
  const { Client } = require('ssh2');
  const fs = require('fs');
  
  const result = {
    success: false,
    stdout: '',
    stderr: '',
    error: null
  };
  
  console.log('[SSH Exec] Starting command on:', config.host);
  console.log('[SSH Exec] Command:', command.substring(0, 100));
  
  const conn = new Client();
  
  const connect = () => {
    return new Promise((resolve, reject) => {
      const connConfig = {
        host: config.host,
        port: config.port || 22,
        username: config.username,
        readyTimeout: 30000
      };
      
      if (config.useKey && config.keyPath) {
        const keyPath = config.keyPath.replace('~', process.env.HOME);
        try {
          connConfig.privateKey = fs.readFileSync(keyPath);
        } catch (e) {
          reject(new Error(`无法读取密钥文件: ${e.message}`));
          return;
        }
      } else if (config.password) {
        connConfig.password = config.password;
      } else {
        reject(new Error('请提供密码或密钥路径'));
        return;
      }
      
      conn.on('ready', () => {
        console.log('[SSH Exec] Connection successful');
        resolve();
      });
      
      conn.on('error', (err) => {
        console.log('[SSH Exec] Connection failed:', err.message);
        reject(err);
      });
      
      conn.connect(connConfig);
    });
  };
  
  try {
    await connect();
    
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.log('[SSH Exec] Command timeout after 60s');
        result.success = true;
        result.stdout = result.stdout || '命令执行超时，但可能已在后台运行';
        resolve(result);
      }, 60000);
      
      conn.exec(command, (err, stream) => {
        if (err) {
          clearTimeout(timeout);
          result.error = err.message;
          reject(err);
          return;
        }
        
        stream.on('data', (data) => {
          result.stdout += data.toString();
          event.sender.send('ssh-command-output', { 
            type: 'stdout', 
            data: data.toString() 
          });
        });
        
        stream.stderr.on('data', (data) => {
          result.stderr += data.toString();
          event.sender.send('ssh-command-output', { 
            type: 'stderr', 
            data: data.toString() 
          });
        });
        
        stream.on('close', (code, signal) => {
          clearTimeout(timeout);
          result.success = code === 0;
          result.exitCode = code;
          console.log('[SSH Exec] Command completed, exit code:', code);
          resolve(result);
        });
      });
    });
    
  } catch (error) {
    result.error = error.message;
    console.log('[SSH Exec] Error:', error.message);
  } finally {
    conn.end();
  }
  
  return result;
});

ipcMain.handle('install-remote-service', async (event, { sshConfig, serviceConfig }) => {
  const { Client } = require('ssh2');
  
  const result = {
    success: false,
    message: '',
    output: ''
  };
  
  const conn = new Client();
  
  try {
    await new Promise((resolve, reject) => {
      const connConfig = {
        host: sshConfig.host,
        port: sshConfig.port || 22,
        username: sshConfig.username,
        readyTimeout: 30000
      };
      
      if (sshConfig.useKey && sshConfig.keyPath) {
        const keyPath = sshConfig.keyPath.replace('~', process.env.HOME);
        try {
          connConfig.privateKey = fs.readFileSync(keyPath);
        } catch (e) {
          reject(new Error(`无法读取密钥文件: ${e.message}`));
          return;
        }
      } else if (sshConfig.password) {
        connConfig.password = sshConfig.password;
      } else {
        reject(new Error('请提供密码或密钥路径'));
        return;
      }
      
      conn.on('ready', () => resolve());
      conn.on('error', reject);
      conn.connect(connConfig);
    });
    
    const execCmd = (cmd) => {
      return new Promise((resolve) => {
        conn.exec(cmd, (err, stream) => {
          if (err) {
            resolve({ success: false, output: err.message });
            return;
          }
          
          let output = '';
          stream.on('data', (data) => { output += data.toString(); });
          stream.stderr.on('data', (data) => { output += data.toString(); });
          stream.on('close', (code) => {
            resolve({ success: code === 0, output });
          });
        });
      });
    };
    
    const homeDir = serviceConfig.homeDir || '~';
    const enginePath = `${homeDir}/.mychat/engines/llama-server`;
    const modelsDir = serviceConfig.modelsDir || `${homeDir}/.mychat/models/gguf`;
    const modelsPreset = serviceConfig.modelsPreset || `${homeDir}/.mychat/gguf/model-config.ini`;
    const logDir = `${homeDir}/.mychat/logs`;
    const scriptPath = `${homeDir}/.mychat/scripts/start-model-pool.sh`;
    const port = serviceConfig.port || 8080;
    const maxModels = serviceConfig.maxModels || 2;
    const host = serviceConfig.host || '0.0.0.0';
    const contextSize = serviceConfig.contextSize || 8192;
    
    const osCheck = await execCmd('uname -s');
    const isLinux = osCheck.output.trim().toLowerCase() === 'linux';
    const isDarwin = osCheck.output.trim().toLowerCase() === 'darwin';
    
    if (!isLinux && !isDarwin) {
      result.message = '仅支持 Linux 和 macOS 系统';
      conn.end();
      return result;
    }
    
    await execCmd(`mkdir -p ${logDir} ${homeDir}/.mychat/scripts`);
    
    const startScript = `#!/bin/bash
# MyChat Model Pool Service
export PATH="/usr/local/bin:$PATH"

LOG_FILE="${logDir}/model-pool-service.log"
CONFIG_PATH="${modelsPreset}"
MODELS_DIR="${modelsDir}"
BINARY_PATH="${enginePath}"
PORT="${port}"
MAX_MODELS="${maxModels}"
HOST="${host}"
CTX_SIZE="${contextSize}"

echo "$(date): Starting Model Pool Service" >> "$LOG_FILE"
echo "$(date): Config: $CONFIG_PATH" >> "$LOG_FILE"
echo "$(date): Models Dir: $MODELS_DIR" >> "$LOG_FILE"
echo "$(date): Port: $PORT" >> "$LOG_FILE"

if [ -f "$CONFIG_PATH" ]; then
  PRESET_ARG="--models-preset $CONFIG_PATH"
else
  PRESET_ARG=""
fi

"$BINARY_PATH" \\
  $PRESET_ARG \\
  --models-dir "$MODELS_DIR" \\
  --models-max "$MAX_MODELS" \\
  --ctx-size "$CTX_SIZE" \\
  --jinja \\
  --host "$HOST" \\
  --port "$PORT" \\
  --log-file "${logDir}/llama_server.log" \\
  >> "$LOG_FILE" 2>&1
`;
    
    const writeScript = await execCmd(`cat > ${scriptPath} << 'EOFSCRIPT'
${startScript}
EOFSCRIPT
chmod +x ${scriptPath}`);
    
    if (!writeScript.success) {
      result.message = '创建启动脚本失败';
      result.output = writeScript.output;
      conn.end();
      return result;
    }
    
    if (isLinux) {
      const serviceName = 'mychat-modelpool';
      const servicePath = '/etc/systemd/system/mychat-modelpool.service';
      
      const systemdService = `[Unit]
Description=MyChat Model Pool Service
After=network.target

[Service]
Type=simple
ExecStart=/bin/bash ${scriptPath}
Restart=on-failure
RestartSec=10
User=${sshConfig.username}
WorkingDirectory=${homeDir}/.mychat

[Install]
WantedBy=multi-user.target
`;
      
      const writeService = await execCmd(`echo '${systemdService.replace(/'/g, "'\\''")}' | sudo tee ${servicePath}`);
      
      if (!writeService.success) {
        result.message = '创建 systemd 服务文件失败，可能需要 sudo 权限';
        result.output = writeService.output;
        result.success = true;
        result.message = '启动脚本已创建，请手动创建 systemd 服务';
        conn.end();
        return result;
      }
      
      await execCmd('sudo systemctl daemon-reload');
      await execCmd(`sudo systemctl enable ${serviceName}`);
      await execCmd(`sudo systemctl start ${serviceName}`);
      
      result.success = true;
      result.message = 'systemd 服务已安装并启动';
      
    } else if (isDarwin) {
      const plistName = 'com.mychat.modelpool';
      const plistPath = `${homeDir}/Library/LaunchAgents/${plistName}.plist`;
      
      const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${plistName}</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>${scriptPath}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <false/>
    <key>StandardOutPath</key>
    <string>${logDir}/model-pool-stdout.log</string>
    <key>StandardErrorPath</key>
    <string>${logDir}/model-pool-stderr.log</string>
    <key>WorkingDirectory</key>
    <string>${homeDir}/.mychat</string>
</dict>
</plist>
`;
      
      const writePlist = await execCmd(`cat > ${plistPath} << 'EOFPLIST'
${plistContent}
EOFPLIST`);
      
      if (!writePlist.success) {
        result.message = '创建 launchd plist 文件失败';
        result.output = writePlist.output;
        conn.end();
        return result;
      }
      
      await execCmd(`launchctl load ${plistPath}`);
      
      result.success = true;
      result.message = 'launchd 服务已安装并启动';
    }
    
  } catch (error) {
    result.message = error.message;
  } finally {
    conn.end();
  }
  
  return result;
});

ipcMain.handle('get-remote-service-status', async (event, { sshConfig }) => {
  const { Client } = require('ssh2');
  
  const result = {
    success: false,
    installed: false,
    running: false,
    enabled: false,
    pid: null,
    port: null,
    uptime: null,
    message: ''
  };
  
  const conn = new Client();
  
  try {
    await new Promise((resolve, reject) => {
      const connConfig = {
        host: sshConfig.host,
        port: sshConfig.port || 22,
        username: sshConfig.username,
        readyTimeout: 15000
      };
      
      if (sshConfig.useKey && sshConfig.keyPath) {
        const keyPath = sshConfig.keyPath.replace('~', process.env.HOME);
        connConfig.privateKey = fs.readFileSync(keyPath);
      } else if (sshConfig.password) {
        connConfig.password = sshConfig.password;
      } else {
        reject(new Error('请提供密码或密钥路径'));
        return;
      }
      
      conn.on('ready', () => resolve());
      conn.on('error', reject);
      conn.connect(connConfig);
    });
    
    const execCmd = (cmd) => {
      return new Promise((resolve) => {
        conn.exec(cmd, (err, stream) => {
          if (err) {
            resolve({ success: false, output: err.message });
            return;
          }
          
          let output = '';
          stream.on('data', (data) => { output += data.toString(); });
          stream.stderr.on('data', (data) => { output += data.toString(); });
          stream.on('close', () => {
            resolve({ success: true, output });
          });
        });
      });
    };
    
    const osCheck = await execCmd('uname -s');
    const isLinux = osCheck.output.trim().toLowerCase() === 'linux';
    const isDarwin = osCheck.output.trim().toLowerCase() === 'darwin';
    
    if (isLinux) {
      const serviceExists = await execCmd('systemctl list-unit-files mychat-modelpool.service 2>/dev/null | grep -q mychat-modelpool && echo YES || echo NO');
      result.installed = serviceExists.output.includes('YES');
      
      if (result.installed) {
        const enabledCheck = await execCmd('systemctl is-enabled mychat-modelpool 2>/dev/null || echo disabled');
        result.enabled = enabledCheck.output.trim() === 'enabled';
        
        const statusCheck = await execCmd('systemctl is-active mychat-modelpool 2>/dev/null || echo inactive');
        result.running = statusCheck.output.trim() === 'active';
        
        if (result.running) {
          const pidCheck = await execCmd('systemctl show --property MainPID mychat-modelpool 2>/dev/null | cut -d= -f2');
          result.pid = pidCheck.output.trim();
        }
      }
    } else if (isDarwin) {
      const plistCheck = await execCmd('launchctl list com.mychat.modelpool 2>/dev/null && echo YES || echo NO');
      result.installed = plistCheck.output.includes('YES');
      result.enabled = result.installed;
      
      if (result.installed) {
        const listOutput = await execCmd('launchctl list | grep com.mychat.modelpool || echo ""');
        result.running = listOutput.output.includes('com.mychat.modelpool');
        
        if (result.running) {
          const pidMatch = listOutput.output.match(/^\s*(\d+)/m);
          if (pidMatch) {
            result.pid = pidMatch[1];
          }
        }
      }
    }
    
    const processCheck = await execCmd('ps aux | grep llama-server | grep -v grep || echo ""');
    if (processCheck.output.trim()) {
      const lines = processCheck.output.trim().split('\n');
      for (const line of lines) {
        const portMatch = line.match(/--port\s+(\d+)/);
        if (portMatch) {
          result.port = parseInt(portMatch[1]);
          break;
        }
      }
      
      if (!result.pid) {
        const pidMatch = processCheck.output.match(/^\S+\s+(\d+)/);
        if (pidMatch) {
          result.pid = pidMatch[1];
        }
      }
      
      if (!result.running) {
        result.running = true;
      }
    }
    
    result.success = true;
    result.message = result.running ? '服务运行中' : (result.installed ? '服务已安装但未运行' : '服务未安装');
    
  } catch (error) {
    result.message = error.message;
  } finally {
    conn.end();
  }
  
  return result;
});

ipcMain.handle('restart-remote-service', async (event, { sshConfig }) => {
  const { Client } = require('ssh2');
  
  const result = {
    success: false,
    message: '',
    output: ''
  };
  
  const conn = new Client();
  
  try {
    await new Promise((resolve, reject) => {
      const connConfig = {
        host: sshConfig.host,
        port: sshConfig.port || 22,
        username: sshConfig.username,
        readyTimeout: 15000
      };
      
      if (sshConfig.useKey && sshConfig.keyPath) {
        const keyPath = sshConfig.keyPath.replace('~', process.env.HOME);
        connConfig.privateKey = fs.readFileSync(keyPath);
      } else if (sshConfig.password) {
        connConfig.password = sshConfig.password;
      } else {
        reject(new Error('请提供密码或密钥路径'));
        return;
      }
      
      conn.on('ready', () => resolve());
      conn.on('error', reject);
      conn.connect(connConfig);
    });
    
    const execCmd = (cmd) => {
      return new Promise((resolve) => {
        conn.exec(cmd, (err, stream) => {
          if (err) {
            resolve({ success: false, output: err.message });
            return;
          }
          
          let output = '';
          stream.on('data', (data) => { output += data.toString(); });
          stream.stderr.on('data', (data) => { output += data.toString(); });
          stream.on('close', (code) => {
            resolve({ success: code === 0, output });
          });
        });
      });
    };
    
    const osCheck = await execCmd('uname -s');
    const isLinux = osCheck.output.trim().toLowerCase() === 'linux';
    const isDarwin = osCheck.output.trim().toLowerCase() === 'darwin';
    
    if (isLinux) {
      const restartResult = await execCmd('sudo systemctl restart mychat-modelpool 2>&1');
      if (restartResult.success) {
        result.success = true;
        result.message = '服务已重启';
      } else {
        result.message = '重启服务失败，可能需要 sudo 权限';
        result.output = restartResult.output;
      }
    } else if (isDarwin) {
      const homeDir = (await execCmd('echo $HOME')).output.trim();
      const plistPath = `${homeDir}/Library/LaunchAgents/com.mychat.modelpool.plist`;
      
      await execCmd(`launchctl unload ${plistPath} 2>/dev/null || true`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      await execCmd(`launchctl load ${plistPath}`);
      
      result.success = true;
      result.message = '服务已重启';
    } else {
      result.message = '不支持的操作系统';
    }
    
  } catch (error) {
    result.message = error.message;
  } finally {
    conn.end();
  }
  
  return result;
});

ipcMain.handle('uninstall-remote-service', async (event, { sshConfig }) => {
  const { Client } = require('ssh2');
  
  const result = {
    success: false,
    message: '',
    output: ''
  };
  
  const conn = new Client();
  
  try {
    await new Promise((resolve, reject) => {
      const connConfig = {
        host: sshConfig.host,
        port: sshConfig.port || 22,
        username: sshConfig.username,
        readyTimeout: 15000
      };
      
      if (sshConfig.useKey && sshConfig.keyPath) {
        const keyPath = sshConfig.keyPath.replace('~', process.env.HOME);
        connConfig.privateKey = fs.readFileSync(keyPath);
      } else if (sshConfig.password) {
        connConfig.password = sshConfig.password;
      } else {
        reject(new Error('请提供密码或密钥路径'));
        return;
      }
      
      conn.on('ready', () => resolve());
      conn.on('error', reject);
      conn.connect(connConfig);
    });
    
    const execCmd = (cmd) => {
      return new Promise((resolve) => {
        conn.exec(cmd, (err, stream) => {
          if (err) {
            resolve({ success: false, output: err.message });
            return;
          }
          
          let output = '';
          stream.on('data', (data) => { output += data.toString(); });
          stream.stderr.on('data', (data) => { output += data.toString(); });
          stream.on('close', (code) => {
            resolve({ success: code === 0, output });
          });
        });
      });
    };
    
    const osCheck = await execCmd('uname -s');
    const isLinux = osCheck.output.trim().toLowerCase() === 'linux';
    const isDarwin = osCheck.output.trim().toLowerCase() === 'darwin';
    
    if (isLinux) {
      await execCmd('sudo systemctl stop mychat-modelpool 2>/dev/null || true');
      await execCmd('sudo systemctl disable mychat-modelpool 2>/dev/null || true');
      await execCmd('sudo rm -f /etc/systemd/system/mychat-modelpool.service');
      await execCmd('sudo systemctl daemon-reload');
      
      result.success = true;
      result.message = 'systemd 服务已卸载';
    } else if (isDarwin) {
      const homeDir = (await execCmd('echo $HOME')).output.trim();
      const plistPath = `${homeDir}/Library/LaunchAgents/com.mychat.modelpool.plist`;
      
      await execCmd(`launchctl unload ${plistPath} 2>/dev/null || true`);
      await execCmd(`rm -f ${plistPath}`);
      
      result.success = true;
      result.message = 'launchd 服务已卸载';
    } else {
      result.message = '不支持的操作系统';
    }
    
    const homeDir = (await execCmd('echo $HOME')).output.trim();
    await execCmd(`rm -f ${homeDir}/.mychat/scripts/start-model-pool.sh`);
    
  } catch (error) {
    result.message = error.message;
  } finally {
    conn.end();
  }
  
  return result;
});

ipcMain.handle('download-engine', async (event, { engine }) => {
  const { downloadEngine } = require('../scripts/download-engines.js');
  const platform = process.platform;
  const arch = process.arch;
  
  try {
    const result = await downloadEngine(engine, platform, arch, null,
      (downloaded, total) => {
        event.sender.send('engine-download-progress', {
          engine,
          downloaded,
          total,
          progress: total ? (downloaded / total * 100).toFixed(1) : 0
        });
      },
      (logEntry) => {
        event.sender.send('engine-download-log', {
          engine,
          ...logEntry
        });
      }
    );
    return { success: !!result, path: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('test-engine', async (event, { engine, config }) => {
  try {
    const http = require('http');
    const port = config.port || enginePort;
    
    return new Promise((resolve) => {
      const req = http.get(`http://127.0.0.1:${port}/v1/models`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({ success: true, message: '连接成功！引擎正在运行。' });
        });
      });
      
      req.on('error', () => {
        resolve({ success: false, message: '无法连接到引擎，请确保引擎已启动。' });
      });
      
      req.setTimeout(5000, () => {
        req.destroy();
        resolve({ success: false, message: '连接超时' });
      });
    });
  } catch (error) {
    return { success: false, message: error.message };
  }
});

let zeroclawProcess = null;

function getZeroclawConfigPath() {
  const homeDir = app.getPath('home');
  return path.join(homeDir, '.mychat', 'zeroclaw.json');
}

async function startZeroclaw(config) {
  return new Promise((resolve, reject) => {
    if (zeroclawProcess) {
      sendLog('正在停止现有 ZeroClaw...', 'info');
      zeroclawProcess.kill();
      zeroclawProcess = null;
    }

    const binaryPath = getEngineBinaryPath('zeroclaw');
    
    if (!binaryPath || !fs.existsSync(binaryPath)) {
      sendLog('ZeroClaw 二进制文件未找到，请先下载', 'warning');
      resolve({ success: false, message: 'ZeroClaw 未安装' });
      return;
    }

    if (!config.server || !config.server.port) {
      sendLog('缺少服务器配置', 'error');
      resolve({ success: false, message: '缺少服务器配置' });
      return;
    }

    sendLog('启动 ZeroClaw Gateway...', 'info');
    sendLog(`端口: ${config.server.port}`, 'info');
    sendLog(`主机: ${config.server.host || '127.0.0.1'}`, 'info');

    const engineDir = path.dirname(binaryPath);
    const args = ['gateway', '--port', String(config.server.port)];
    
    if (config.server.host) {
      args.push('--host', config.server.host);
    }
    
    zeroclawProcess = spawn(binaryPath, args, { cwd: engineDir });
    
    let resolved = false;

    zeroclawProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('[zeroclaw]', output);
      sendLog(output.trim(), 'stdout');
      
      if (!resolved && (output.includes('Server started') || output.includes('Listening on') || output.includes('gateway'))) {
        resolved = true;
        sendLog('ZeroClaw Gateway 启动成功!', 'success');
        resolve({ success: true, message: '启动成功', port: config.server.port });
      }
    });

    zeroclawProcess.stderr.on('data', (data) => {
      const output = data.toString();
      console.error('[zeroclaw error]', output);
      sendLog(output.trim(), 'stderr');
    });

    zeroclawProcess.on('error', (err) => {
      console.error('Failed to start ZeroClaw:', err);
      sendLog(`启动失败: ${err.message}`, 'error');
      if (!resolved) {
        resolve({ success: false, message: err.message });
      }
    });

    zeroclawProcess.on('close', (code) => {
      console.log(`ZeroClaw exited with code ${code}`);
      sendLog(`ZeroClaw 已退出 (代码: ${code})`, code === 0 ? 'info' : 'warning');
      zeroclawProcess = null;
    });

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        sendLog('ZeroClaw Gateway 启动超时，假设已启动', 'warning');
        resolve({ success: true, message: '启动超时', port: config.server.port });
      }
    }, 10000);
  });
}

async function stopZeroclaw() {
  return new Promise((resolve) => {
    if (zeroclawProcess) {
      sendLog('正在停止 ZeroClaw...', 'info');
      zeroclawProcess.on('close', () => {
        sendLog('ZeroClaw 已停止', 'info');
        resolve();
      });
      zeroclawProcess.kill();
      zeroclawProcess = null;
    } else {
      resolve();
    }
  });
}

ipcMain.handle('start-zeroclaw', async (event, config) => {
  return startZeroclaw(config);
});

ipcMain.handle('stop-zeroclaw', async () => {
  return stopZeroclaw();
});

ipcMain.handle('get-zeroclaw-status', () => {
  return {
    running: zeroclawProcess !== null,
    port: zeroclawProcess ? 3000 : 0
  };
});

ipcMain.handle('zeroclaw-doctor', async () => {
  return new Promise((resolve) => {
    const binaryPath = getEngineBinaryPath('zeroclaw');
    
    if (!binaryPath || !fs.existsSync(binaryPath)) {
      resolve({ success: false, output: 'ZeroClaw 未安装' });
      return;
    }

    const engineDir = path.dirname(binaryPath);
    const doctorProcess = spawn(binaryPath, ['doctor'], { cwd: engineDir });
    
    let output = '';

    doctorProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    doctorProcess.stderr.on('data', (data) => {
      output += data.toString();
    });

    doctorProcess.on('close', (code) => {
      resolve({ success: code === 0, output });
    });

    doctorProcess.on('error', (err) => {
      resolve({ success: false, output: err.message });
    });
  });
});

ipcMain.handle('zeroclaw-status', async () => {
  return new Promise((resolve) => {
    const binaryPath = getEngineBinaryPath('zeroclaw');
    
    if (!binaryPath || !fs.existsSync(binaryPath)) {
      resolve({ success: false, output: 'ZeroClaw 未安装' });
      return;
    }

    const engineDir = path.dirname(binaryPath);
    const statusProcess = spawn(binaryPath, ['status'], { cwd: engineDir });
    
    let output = '';

    statusProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    statusProcess.stderr.on('data', (data) => {
      output += data.toString();
    });

    statusProcess.on('close', (code) => {
      resolve({ success: code === 0, output });
    });

    statusProcess.on('error', (err) => {
      resolve({ success: false, output: err.message });
    });
  });
});

ipcMain.handle('save-zeroclaw-config', (event, config) => {
  const configPath = getZeroclawConfigPath();
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  return true;
});

ipcMain.handle('get-zeroclaw-config', () => {
  const configPath = getZeroclawConfigPath();
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }
  return null;
});

ipcMain.handle('delete-model', async (event, filename) => {
  const modelsDir = getModelsDir();
  const filePath = path.join(modelsDir, filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
});

ipcMain.handle('get-config', (event, modelName) => {
  const configPath = getConfigPath(modelName);
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }
  
  const defaultConfigPath = getConfigPath();
  if (!modelName && fs.existsSync(defaultConfigPath)) {
    return JSON.parse(fs.readFileSync(defaultConfigPath, 'utf-8'));
  }
  
  return null;
});

ipcMain.handle('save-config', (event, { config, modelName }) => {
  const configPath = getConfigPath(modelName);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  return true;
});

ipcMain.handle('check-first-run', () => {
  const configPath = getConfigPath();
  return !fs.existsSync(configPath);
});

ipcMain.handle('download-model', async (event, { url, filename, expectedSize }) => {
  const https = require('https');
  const http = require('http');
  const modelsDir = getModelsDir();
  const filePath = path.join(modelsDir, filename);
  
  return new Promise((resolve, reject) => {
    const downloadWithUrl = (downloadUrl, redirectCount = 0) => {
      if (redirectCount > 10) {
        reject(new Error('Too many redirects'));
        return;
      }
      
      let existingSize = 0;
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        existingSize = stats.size;
        event.sender.send('download-progress', {
          progress: '0',
          downloaded: existingSize,
          totalSize: expectedSize || 0,
          resuming: true
        });
      }
      
      const protocol = downloadUrl.startsWith('https') ? https : http;
      const options = new URL(downloadUrl);
      
      options.headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Encoding': 'identity',
      };
      
      if (existingSize > 0) {
        options.headers['Range'] = `bytes=${existingSize}-`;
      }
      
      const request = protocol.request(options, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          const redirectUrl = response.headers.location;
          event.sender.send('download-redirect', { url: redirectUrl, filename });
          downloadWithUrl(redirectUrl, redirectCount + 1);
          return;
        }
        
        if (response.statusCode !== 200 && response.statusCode !== 206) {
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }
        
        const totalSize = parseInt(response.headers['content-length'], 10) + existingSize;
        let downloaded = existingSize;
        let lastProgress = 0;
        
        const file = fs.createWriteStream(filePath, { flags: existingSize > 0 ? 'a' : 'w' });
        
        response.on('data', (chunk) => {
          downloaded += chunk.length;
          const progress = totalSize ? (downloaded / totalSize * 100) : 0;
          
          if (progress - lastProgress >= 1 || downloaded === totalSize) {
            lastProgress = progress;
            event.sender.send('download-progress', { 
              progress: progress.toFixed(1), 
              downloaded, 
              totalSize,
              resuming: existingSize > 0
            });
          }
        });
        
        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          resolve({ path: filePath, size: downloaded });
        });
        
        file.on('error', (err) => {
          file.close();
          reject(err);
        });
      });
      
      request.on('error', (err) => {
        reject(err);
      });
      
      request.setTimeout(600000, () => {
        request.destroy();
        reject(new Error('Download timeout'));
      });
      
      request.end();
    };
    
    downloadWithUrl(url);
  });
});

ipcMain.handle('check-model-download', async (event, { filename, expectedSize }) => {
  const modelsDir = getModelsDir();
  const filePath = path.join(modelsDir, filename);
  
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    const size = stats.size;
    const complete = expectedSize ? size >= expectedSize : true;
    return {
      exists: true,
      size,
      expectedSize: expectedSize || size,
      complete,
      progress: expectedSize ? (size / expectedSize * 100).toFixed(1) : '100'
    };
  }
  
  return { exists: false, size: 0, expectedSize: expectedSize || 0, complete: false, progress: '0' };
});
