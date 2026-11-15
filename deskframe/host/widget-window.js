'use strict';

const fs = require('fs');
const path = require('path');
const { BrowserWindow, screen, session } = require('electron');

const READY_TIMEOUT_MS = 10000;

class WidgetWindow {
  constructor({ id, folder, manifest, state, settings, onGone, onReady, onBounds }) {
    Object.assign(this, { id, folder, manifest, state, settings, onGone, onReady, onBounds });
    this.win = null;
    this.ready = false;
    this.readyTimer = null;
    this.boundsTimer = null;
    this.disposed = false;
  }

  create() {
    const w = this.manifest.window || {};
    const size = this.state.size || {};
    const area = screen.getPrimaryDisplay().workArea;
    const clamp = (v, d) => Math.min(4096, Math.max(32, Number.isFinite(v) ? v : d));
    const width = clamp(size.w, w.width || 320);
    const height = clamp(size.h, w.height || 200);
    const pos = this.state.position || {};
    const x = Number.isFinite(pos.x) ? pos.x : Math.round(area.x + (area.width - width) / 2);
    const y = Number.isFinite(pos.y) ? pos.y : Math.round(area.y + (area.height - height) / 2);

    // Network is OFF unless the widget declares it AND the user opted in.
    const netAllowed = (this.manifest.permissions || []).includes('network') &&
      !!this.settings.getGlobal().allowNetwork;
    const partition = `persist:df-${this.id}`;
    try {
      const ses = session.fromPartition(partition);
      ses.webRequest.onBeforeRequest((details, cb) => {
        const u = details.url || '';
        const local = /^(file|data|blob|devtools):/i.test(u);
        const net = netAllowed && /^https?:/i.test(u);
        cb({ cancel: !(local || net) });
      });
    } catch (err) {
      this.settings.log('warn', this.id, `network policy unavailable: ${err.message}`);
    }

    const win = new BrowserWindow({
      x, y, width, height,
      frame: false,
      transparent: w.transparent !== false,
      backgroundColor: '#00000000',
      hasShadow: false,
      skipTaskbar: true,
      resizable: w.resizable === true,
      alwaysOnTop: !!this.state.alwaysOnTop,
      show: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        partition,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
        allowRunningInsecureContent: false,
        devTools: false,
        spellcheck: false
      }
    });
    this.win = win;
    win.setOpacity(typeof this.state.opacity === 'number' ? this.state.opacity : 1);
    win.setIgnoreMouseEvents(!!this.state.clickThrough, { forward: true });

    const contents = win.webContents;
    contents.on('will-navigate', (event, url) => {
      if (!this.isLocal(url)) {
        event.preventDefault();
        this.settings.log('warn', this.id, `blocked navigation: ${url}`);
      }
    });
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
    contents.on('render-process-gone', (_e, details) => {
      this.fail(`render-process-gone: ${details && details.reason ? details.reason : 'unknown'}`);
    });
    contents.on('did-finish-load', () => {
      if (this.disposed) return;
      win.showInactive();
      this.armReadyTimer();
    });
    win.on('move', () => this.scheduleBoundsSave());
    win.on('resize', () => this.scheduleBoundsSave());
    win.on('closed', () => { this.clearReadyTimer(); this.win = null; });

    const entry = path.resolve(this.folder, this.manifest.entry || 'index.html');
    if (!this.isInside(entry)) throw new Error(`entry escapes widget folder: ${this.manifest.entry}`);
    if (!fs.existsSync(entry)) throw new Error(`entry missing: ${entry}`);
    win.loadFile(entry).catch((err) => {
      this.settings.log('error', this.id, `loadFile failed: ${err.message}`);
      this.fail('load-failed');
    });
  }

  isLocal(url) {
    if (typeof url !== 'string' || !url.startsWith('file://')) return false;
    try {
      let p = decodeURIComponent(new URL(url).pathname);
      if (/^\/[A-Za-z]:\//.test(p)) p = p.slice(1);
      return this.isInside(path.resolve(p));
    } catch (_) {
      return false;
    }
  }

  isInside(target) {
    const rel = path.relative(path.resolve(this.folder), path.resolve(target));
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
  }

  armReadyTimer() {
    this.clearReadyTimer();
    this.readyTimer = setTimeout(() => {
      if (!this.ready && !this.disposed) {
        this.settings.log('error', this.id, 'deskframe.ready() timeout');
        this.fail('ready-timeout');
      }
    }, READY_TIMEOUT_MS);
  }

  clearReadyTimer() {
    if (this.readyTimer) {
      clearTimeout(this.readyTimer);
      this.readyTimer = null;
    }
  }

  fail(reason) {
    this.clearReadyTimer();
    this.destroyWindow();
    if (!this.disposed) this.onGone(this.id, reason);
  }

  destroyWindow() {
    if (this.win && !this.win.isDestroyed()) {
      try { this.win.destroy(); } catch (_) { /* already gone */ }
    }
    this.win = null;
  }

  markReady() {
    this.ready = true;
    this.clearReadyTimer();
    this.send('show', { id: this.id });
    if (this.onReady) this.onReady(this.id);
  }

  send(event, payload) {
    if (this.win && !this.win.isDestroyed() && this.win.webContents && !this.win.webContents.isDestroyed()) {
      try { this.win.webContents.send('df:host-event', { event, payload }); } catch (_) { /* isolated */ }
    }
  }

  scheduleBoundsSave() {
    clearTimeout(this.boundsTimer);
    this.boundsTimer = setTimeout(() => {
      if (this.disposed || !this.win || this.win.isDestroyed()) return;
      try {
        const [x, y] = this.win.getPosition();
        const [w, h] = this.win.getSize();
        this.onBounds(this.id, { position: { x, y }, size: { w, h } });
      } catch (_) { /* isolated */ }
    }, 400);
  }

  applyState(partial) {
    if (!this.win || this.win.isDestroyed()) return;
    if (typeof partial.opacity === 'number') this.win.setOpacity(Math.min(1, Math.max(0.1, partial.opacity)));
    if (typeof partial.clickThrough === 'boolean') this.win.setIgnoreMouseEvents(partial.clickThrough, { forward: true });
    if (typeof partial.alwaysOnTop === 'boolean') this.win.setAlwaysOnTop(partial.alwaysOnTop);
    if (partial.size && this.win.resizable) this.win.setSize(partial.size.w, partial.size.h);
  }

  reload() {
    if (this.win && !this.win.isDestroyed()) {
      this.ready = false;
      this.win.reload();
    }
  }

  destroy() {
    this.disposed = true;
    this.clearReadyTimer();
    clearTimeout(this.boundsTimer);
    this.destroyWindow();
  }
}

module.exports = WidgetWindow;
