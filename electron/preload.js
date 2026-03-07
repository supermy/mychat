const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getSystemMemory: () => ipcRenderer.invoke('get-system-memory'),
  getModelsDir: () => ipcRenderer.invoke('get-models-dir'),
  listModels: () => ipcRenderer.invoke('list-models'),
  startLlama: (options) => ipcRenderer.invoke('start-llama', options),
  stopLlama: () => ipcRenderer.invoke('stop-llama'),
  getLlamaStatus: () => ipcRenderer.invoke('get-llama-status'),
  downloadModel: (options) => ipcRenderer.invoke('download-model', options),
  deleteModel: (filename) => ipcRenderer.invoke('delete-model', filename),
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download-progress', (event, data) => callback(data));
  },
  removeDownloadProgressListener: () => {
    ipcRenderer.removeAllListeners('download-progress');
  }
});
