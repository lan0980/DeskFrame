'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('deskManager', {
  invoke: (method, payload) => ipcRenderer.invoke('df:manager', { method, payload: payload || {} })
});
