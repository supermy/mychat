const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

let mainWindow;
let engineProcess = null;
let enginePort = 8080;
let currentEngine = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

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

function getConfigPath() {
  const homeDir = app.getPath('home');
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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
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
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

function startEngine(engine, config) {
  return new Promise((resolve, reject) => {
    if (engineProcess) {
      engineProcess.kill();
      engineProcess = null;
    }

    const binaryPath = getEngineBinaryPath(engine);
    
    if (!binaryPath || !fs.existsSync(binaryPath)) {
      console.log(`${engine} binary not found, will use external API`);
      resolve({ port: config.port || enginePort, external: true });
      return;
    }

    let args;
    if (engine === 'llama') {
      args = [
        '-m', config.modelPath,
        '--host', '127.0.0.1',
        '--port', (config.port || enginePort).toString(),
        '--ctx-size', (config.contextSize || 4096).toString(),
        '--n-gpu-layers', (config.gpuLayers ?? -1).toString(),
        '--threads', (config.threads || 4).toString(),
        '--cont-batching',
        '--metrics'
      ];
      if (config.flashAttention) {
        args.push('--flash-attn');
      }
    } else if (engine === 'zeroclaw') {
      args = [
        '--model', config.modelPath,
        '--host', '127.0.0.1',
        '--port', (config.port || enginePort).toString(),
        '--ctx-size', (config.contextSize || 4096).toString(),
      ];
    }

    engineProcess = spawn(binaryPath, args);
    currentEngine = engine;
    
    let resolved = false;

    engineProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`[${engine}]`, output);
      
      if (!resolved && (output.includes('HTTP server listening') || output.includes('Server started'))) {
        resolved = true;
        resolve({ port: config.port || enginePort, engine });
      }
    });

    engineProcess.stderr.on('data', (data) => {
      console.error(`[${engine} error]`, data.toString());
    });

    engineProcess.on('error', (err) => {
      console.error(`Failed to start ${engine}:`, err);
      if (!resolved) {
        resolve({ port: config.port || enginePort, external: true });
      }
    });

    engineProcess.on('close', (code) => {
      console.log(`${engine} exited with code ${code}`);
      engineProcess = null;
      currentEngine = null;
    });

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve({ port: config.port || enginePort, engine });
      }
    }, 5000);
  });
}

function stopEngine() {
  return new Promise((resolve) => {
    if (engineProcess) {
      engineProcess.on('close', () => {
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

ipcMain.handle('get-models-dir', () => {
  return getModelsDir();
});

ipcMain.handle('list-models', () => {
  const modelsDir = getModelsDir();
  if (!fs.existsSync(modelsDir)) {
    return [];
  }
  return fs.readdirSync(modelsDir)
    .filter(f => f.endsWith('.gguf'))
    .map(f => ({
      name: f,
      path: path.join(modelsDir, f),
      size: fs.statSync(path.join(modelsDir, f)).size
    }));
});

ipcMain.handle('get-engine-status', async (event, engine) => {
  const binaryPath = getEngineBinaryPath(engine);
  const installed = binaryPath && fs.existsSync(binaryPath);
  
  return {
    installed,
    path: binaryPath || '',
    version: installed ? '1.0.0' : ''
  };
});

ipcMain.handle('start-engine', async (event, { engine, config }) => {
  return startEngine(engine, config);
});

ipcMain.handle('stop-engine', async () => {
  return stopEngine();
});

ipcMain.handle('get-current-engine', () => {
  return {
    engine: currentEngine,
    running: engineProcess !== null,
    port: enginePort
  };
});

ipcMain.handle('download-engine', async (event, { engine }) => {
  const { downloadEngine } = require('../scripts/download-engines.js');
  const platform = process.platform;
  const arch = process.arch;
  
  try {
    const result = await downloadEngine(engine, platform, arch);
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

ipcMain.handle('delete-model', async (event, filename) => {
  const modelsDir = getModelsDir();
  const filePath = path.join(modelsDir, filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
});

ipcMain.handle('get-config', () => {
  const configPath = getConfigPath();
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }
  return null;
});

ipcMain.handle('save-config', (event, config) => {
  const configPath = getConfigPath();
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  return true;
});

ipcMain.handle('check-first-run', () => {
  const configPath = getConfigPath();
  return !fs.existsSync(configPath);
});

ipcMain.handle('download-model', async (event, { url, filename }) => {
  const https = require('https');
  const http = require('http');
  const modelsDir = getModelsDir();
  const filePath = path.join(modelsDir, filename);
  
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(filePath);
    
    const request = protocol.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        file.close();
        fs.unlinkSync(filePath);
        // Handle redirect
        const redirectUrl = response.headers.location;
        event.sender.send('download-redirect', { url: redirectUrl, filename });
        reject(new Error('Redirect'));
        return;
      }
      
      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloaded = 0;
      
      response.on('data', (chunk) => {
        downloaded += chunk.length;
        const progress = totalSize ? (downloaded / totalSize * 100).toFixed(1) : 0;
        event.sender.send('download-progress', { progress, downloaded, totalSize });
      });
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve({ path: filePath, size: downloaded });
      });
    });
    
    request.on('error', (err) => {
      fs.unlink(filePath, () => {});
      reject(err);
    });
    
    request.setTimeout(600000, () => {
      request.destroy();
      reject(new Error('Download timeout'));
    });
  });
});
