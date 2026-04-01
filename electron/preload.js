const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // System
  getSystemMemory: () => ipcRenderer.invoke('get-system-memory'),
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  checkEngineCompatibility: (engine) => ipcRenderer.invoke('check-engine-compatibility', engine),
  
  // Models
  getModelsDir: () => ipcRenderer.invoke('get-models-dir'),
  getDefaultModel: () => ipcRenderer.invoke('get-default-model'),
  listModels: () => ipcRenderer.invoke('list-models'),
  downloadModel: (options) => ipcRenderer.invoke('download-model', options),
  checkModelDownload: (options) => ipcRenderer.invoke('check-model-download', options),
  deleteModel: (filename) => ipcRenderer.invoke('delete-model', filename),
  
  // Engines
  getEngineStatus: (engine) => ipcRenderer.invoke('get-engine-status', engine),
  checkEngineUpdate: (engine) => ipcRenderer.invoke('check-engine-update', engine),
  downloadEngineUpdate: (options) => ipcRenderer.invoke('download-engine-update', options),
  downloadEngine: (engine) => ipcRenderer.invoke('download-engine', { engine }),
  startEngine: (engine, config) => ipcRenderer.invoke('start-engine', { engine, config }),
  stopEngine: () => ipcRenderer.invoke('stop-engine'),
  getCurrentEngine: () => ipcRenderer.invoke('get-current-engine'),
  testEngine: (engine, config) => ipcRenderer.invoke('test-engine', { engine, config }),
  
  // ZeroClaw
  startZeroclaw: (config) => ipcRenderer.invoke('start-zeroclaw', config),
  stopZeroclaw: () => ipcRenderer.invoke('stop-zeroclaw'),
  getZeroclawStatus: () => ipcRenderer.invoke('get-zeroclaw-status'),
  saveZeroclawConfig: (config) => ipcRenderer.invoke('save-zeroclaw-config', config),
  getZeroclawConfig: () => ipcRenderer.invoke('get-zeroclaw-config'),
  zeroclawDoctor: () => ipcRenderer.invoke('zeroclaw-doctor'),
  zeroclawStatus: () => ipcRenderer.invoke('zeroclaw-status'),
  
  // Codex
  startCodex: (config) => ipcRenderer.invoke('start-codex', config),
  stopCodex: () => ipcRenderer.invoke('stop-codex'),
  getCodexStatus: () => ipcRenderer.invoke('get-codex-status'),
  saveCodexConfig: (config) => ipcRenderer.invoke('save-codex-config', config),
  getCodexConfig: () => ipcRenderer.invoke('get-codex-config'),
  codexDoctor: () => ipcRenderer.invoke('codex-doctor'),
  codexStatus: () => ipcRenderer.invoke('codex-status'),
  
  // Model Pool
  startModelPool: (config) => ipcRenderer.invoke('start-model-pool', config),
  generateModelConfig: () => ipcRenderer.invoke('generate-model-config'),
  getModelConfigPath: () => ipcRenderer.invoke('get-model-config-path'),
  getGgufModelsDir: () => ipcRenderer.invoke('get-gguf-models-dir'),
  installModelPoolService: (config) => ipcRenderer.invoke('install-model-pool-service', config),
  uninstallModelPoolService: () => ipcRenderer.invoke('uninstall-model-pool-service'),
  
  // File Operations
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),
  
  // Config
  getConfig: (modelName) => ipcRenderer.invoke('get-config', modelName),
  saveConfig: (config, modelName) => ipcRenderer.invoke('save-config', { config, modelName }),
  checkFirstRun: () => ipcRenderer.invoke('check-first-run'),
  
  // Events
  onDownloadProgress: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('download-progress', handler);
    return () => ipcRenderer.removeListener('download-progress', handler);
  },
  onDownloadRedirect: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('download-redirect', handler);
    return () => ipcRenderer.removeListener('download-redirect', handler);
  },
  onEngineLog: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('engine-log', handler);
    return () => ipcRenderer.removeListener('engine-log', handler);
  },
  onEngineDownloadProgress: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('engine-download-progress', handler);
    return () => ipcRenderer.removeListener('engine-download-progress', handler);
  },
  removeDownloadListeners: () => {
    ipcRenderer.removeAllListeners('download-progress');
    ipcRenderer.removeAllListeners('download-redirect');
    ipcRenderer.removeAllListeners('engine-log');
    ipcRenderer.removeAllListeners('engine-download-progress');
  },
  
  // App Config persistence
  saveAppConfig: (config) => ipcRenderer.invoke('save-app-config', config),
  loadAppConfig: () => ipcRenderer.invoke('load-app-config'),
  
  // SSH Probe
  probeSSHHost: (config) => ipcRenderer.invoke('probe-ssh-host', config),
  
  // SSH Command Execution
  executeSSHCommand: (config, command) => ipcRenderer.invoke('execute-ssh-command', { config, command }),
  onSSHCommandOutput: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('ssh-command-output', handler);
    return () => ipcRenderer.removeListener('ssh-command-output', handler);
  }
});
