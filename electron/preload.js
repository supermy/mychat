const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // System
  getSystemMemory: () => ipcRenderer.invoke('get-system-memory'),
  
  // Models
  getModelsDir: () => ipcRenderer.invoke('get-models-dir'),
  getDefaultModel: () => ipcRenderer.invoke('get-default-model'),
  listModels: () => ipcRenderer.invoke('list-models'),
  downloadModel: (options) => ipcRenderer.invoke('download-model', options),
  deleteModel: (filename) => ipcRenderer.invoke('delete-model', filename),
  
  // Engines
  getEngineStatus: (engine) => ipcRenderer.invoke('get-engine-status', engine),
  downloadEngine: (engine) => ipcRenderer.invoke('download-engine', { engine }),
  startEngine: (engine, config) => ipcRenderer.invoke('start-engine', { engine, config }),
  stopEngine: () => ipcRenderer.invoke('stop-engine'),
  getCurrentEngine: () => ipcRenderer.invoke('get-current-engine'),
  testEngine: (engine, config) => ipcRenderer.invoke('test-engine', { engine, config }),
  
  // Config
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  checkFirstRun: () => ipcRenderer.invoke('check-first-run'),
  
  // Events
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download-progress', (event, data) => callback(data));
  },
  onDownloadRedirect: (callback) => {
    ipcRenderer.on('download-redirect', (event, data) => callback(data));
  },
  removeDownloadListeners: () => {
    ipcRenderer.removeAllListeners('download-progress');
    ipcRenderer.removeAllListeners('download-redirect');
  }
});
