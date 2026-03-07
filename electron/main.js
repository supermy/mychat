const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

let mainWindow;
let llamaProcess = null;
let llamaPort = 8080;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function getLlamaBinaryPath() {
  const platform = process.platform;
  const arch = process.arch;
  
  let binaryName;
  if (platform === 'darwin') {
    binaryName = arch === 'arm64' ? 'llama-server' : 'llama-server';
  } else if (platform === 'win32') {
    binaryName = 'llama-server.exe';
  } else {
    binaryName = 'llama-server';
  }
  
  if (isDev) {
    return path.join(__dirname, '..', 'llama-binaries', platform, binaryName);
  }
  
  return path.join(process.resourcesPath, 'llama-binaries', binaryName);
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

function startLlamaServer(modelPath, options = {}) {
  return new Promise((resolve, reject) => {
    if (llamaProcess) {
      llamaProcess.kill();
      llamaProcess = null;
    }

    const binaryPath = getLlamaBinaryPath();
    
    if (!fs.existsSync(binaryPath)) {
      console.log('llama.cpp binary not found, will use external API');
      resolve({ port: llamaPort, external: true });
      return;
    }

    const args = [
      '-m', modelPath,
      '--host', '127.0.0.1',
      '--port', llamaPort.toString(),
      '--ctx-size', (options.ctxSize || 4096).toString(),
      '--n-gpu-layers', (options.gpuLayers || -1).toString(),
      '--threads', (options.threads || 4).toString(),
      '--cont-batching',
      '--metrics'
    ];

    if (options.flashAttention) {
      args.push('--flash-attn');
    }

    const { spawn } = require('child_process');
    llamaProcess = spawn(binaryPath, args);
    
    let resolved = false;

    llamaProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('[llama]', output);
      
      if (!resolved && output.includes('HTTP server listening')) {
        resolved = true;
        resolve({ port: llamaPort });
      }
    });

    llamaProcess.stderr.on('data', (data) => {
      console.error('[llama error]', data.toString());
    });

    llamaProcess.on('error', (err) => {
      console.error('Failed to start llama server:', err);
      if (!resolved) {
        resolve({ port: llamaPort, external: true });
      }
    });

    llamaProcess.on('close', (code) => {
      console.log(`llama server exited with code ${code}`);
      llamaProcess = null;
    });

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve({ port: llamaPort });
      }
    }, 5000);
  });
}

function stopLlamaServer() {
  return new Promise((resolve) => {
    if (llamaProcess) {
      llamaProcess.on('close', () => {
        resolve();
      });
      llamaProcess.kill();
      llamaProcess = null;
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
  stopLlamaServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopLlamaServer();
});

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

ipcMain.handle('start-llama', async (event, { modelPath, options }) => {
  return startLlamaServer(modelPath, options);
});

ipcMain.handle('stop-llama', async () => {
  return stopLlamaServer();
});

ipcMain.handle('get-llama-status', () => {
  return {
    running: llamaProcess !== null,
    port: llamaPort
  };
});

ipcMain.handle('download-model', async (event, { url, filename, onProgress }) => {
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
        const redirectUrl = response.headers.location;
        ipcMain.handle('download-model-redirect', async () => ({ url: redirectUrl, filename }));
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
    
    request.setTimeout(300000, () => {
      request.destroy();
      reject(new Error('Download timeout'));
    });
  });
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
