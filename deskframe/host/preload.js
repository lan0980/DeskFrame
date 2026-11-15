'use strict';

// The ONLY bridge between a widget page and the host.
// Runs in a sandboxed, context-isolated renderer: no Node, no fs, no require.
const { contextBridge, ipcRenderer } = require('electron');

const listeners = new Map();
const MAX_MESSAGE = 1024 * 1024;

ipcRenderer.on('df:host-event', (_event, data) => {
  if (!data || typeof data.event !== 'string') return;
  const set = listeners.get(data.event);
  if (!set) return;
  for (const fn of Array.from(set)) {
    try {
      fn(data.payload);
    } catch (err) {
      // A broken widget callback must never break the host or another widget.
      console.error('[deskframe] listener error', err);
    }
  }
});

function call(method, ...args) {
  if (JSON.stringify(args).length > MAX_MESSAGE) {
    return Promise.reject(new Error('deskframe: message exceeds 1 MB'));
  }
  return ipcRenderer.invoke('df:call', { method, args });
}

function on(event, fn) {
  if (typeof event !== 'string' || typeof fn !== 'function') return () => {};
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(fn);
  return () => off(event, fn);
}

function off(event, fn) {
  const set = listeners.get(event);
  if (!set) return;
  set.delete(fn);
  if (!set.size) listeners.delete(event);
}

contextBridge.exposeInMainWorld('deskframe', {
  apiVersion: 1,

  ready: () => call('ready'),
  getConfig: () => call('getConfig'),
  setConfig: (partial) => call('setConfig', partial),
  getState: () => call('getState'),

  on,
  off,
  emit: (name, payload) => call('emit', name, payload),

  log: (level, msg) => call('log', level, String(msg)),
  openExternal: (url) => call('openExternal', url),
  resize: (w, h) => call('resize', w, h),
  setOpacity: (value) => call('setOpacity', value),
  setClickThrough: (value) => call('setClickThrough', value),
  setBadge: (text) => call('setBadge', text),
  systemInfo: () => call('systemInfo'),
  clipboardRead: () => call('clipboardRead'),
  clipboardWrite: (text) => call('clipboardWrite', text),
  close: () => call('close')
});
