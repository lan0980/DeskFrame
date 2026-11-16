'use strict';

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const SETTINGS_VERSION = 1;

function defaults() {
  return {
    version: SETTINGS_VERSION,
    global: {
      autoHideOnFullscreen: true,
      launchAtLogin: false,
      allowNetwork: false
    },
    widgets: {},
    // Tracks which bundled widgets this install has already been handed, and which ones
    // the user removed on purpose. A removed bundle widget must never reappear on the
    // next launch; only "restore defaults" is allowed to hand them out again.
    bundle: { seededVersion: null, removed: [] }
  };
}

class Settings {
  constructor() {
    this.root = app.getPath('userData');
    this.file = path.join(this.root, 'settings.json');
    this.widgetsDir = path.join(this.root, 'widgets');
    this.logsDir = path.join(this.root, 'logs');
    this.data = defaults();
  }

  ensure() {
    fs.mkdirSync(this.root, { recursive: true });
    fs.mkdirSync(this.widgetsDir, { recursive: true });
    fs.mkdirSync(this.logsDir, { recursive: true });
    if (fs.existsSync(this.file)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(this.file, 'utf8'));
        if (parsed && parsed.version === SETTINGS_VERSION) {
          this.data = Object.assign(defaults(), parsed);
          this.data.global = Object.assign(defaults().global, parsed.global || {});
          this.data.widgets = parsed.widgets || {};
          this.data.bundle = Object.assign(defaults().bundle, parsed.bundle || {});
          this.data.bundle.removed = Array.isArray(this.data.bundle.removed)
            ? this.data.bundle.removed.filter((x) => typeof x === 'string')
            : [];
        }
      } catch (err) {
        this.log('warn', 'settings', `settings.json unreadable, using defaults: ${err.message}`);
      }
    }
    this.save();
  }

  save() {
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf8');
    fs.renameSync(tmp, this.file);
  }

  getGlobal() {
    return this.data.global;
  }

  setGlobal(partial) {
    this.data.global = Object.assign(this.data.global, partial || {});
    this.save();
    return this.data.global;
  }

  widgetState(id) {
    return this.data.widgets[id] || null;
  }

  ensureWidgetState(id, manifest) {
    if (!this.data.widgets[id]) {
      const w = (manifest && manifest.window) || {};
      this.data.widgets[id] = {
        enabled: true,
        position: { x: null, y: null },
        size: { w: w.width || 320, h: w.height || 200 },
        opacity: 1,
        clickThrough: !!w.clickThrough,
        alwaysOnTop: !!w.alwaysOnTop,
        locked: false,
        badge: '',
        config: this.defaultConfig(manifest)
      };
      this.save();
    }
    return this.data.widgets[id];
  }

  defaultConfig(manifest) {
    const out = {};
    const schema = (manifest && manifest.configSchema) || {};
    for (const [key, def] of Object.entries(schema)) {
      if (def.default !== undefined) out[key] = def.default;
    }
    return out;
  }

  setWidgetState(id, partial) {
    const cur = this.data.widgets[id];
    if (!cur) return null;
    this.data.widgets[id] = Object.assign(cur, partial || {});
    this.save();
    return this.data.widgets[id];
  }

  setWidgetConfig(id, partial) {
    const cur = this.data.widgets[id];
    if (!cur) return null;
    cur.config = Object.assign(cur.config || {}, partial || {});
    this.save();
    return cur.config;
  }

  removeWidget(id) {
    delete this.data.widgets[id];
    this.save();
  }

  // ---- bundled widget bookkeeping ----

  bundleState() {
    if (!this.data.bundle) this.data.bundle = defaults().bundle;
    return this.data.bundle;
  }

  bundleRemoved() {
    return new Set(this.bundleState().removed || []);
  }

  markBundleSeeded(version) {
    const b = this.bundleState();
    b.seededVersion = version;
    this.save();
    return b;
  }

  // Called when the user uninstalls a widget that came from the bundle, so the next
  // launch leaves it alone instead of reinstalling something they deliberately removed.
  markBundleRemoved(id) {
    const b = this.bundleState();
    if (!b.removed.includes(id)) b.removed.push(id);
    this.save();
    return b;
  }

  log(level, scope, msg) {
    const line = `${new Date().toISOString()} [${level}] [${scope}] ${msg}\n`;
    try {
      fs.mkdirSync(this.logsDir, { recursive: true });
      const day = new Date().toISOString().slice(0, 10);
      fs.appendFileSync(path.join(this.logsDir, `${day}.log`), line, 'utf8');
    } catch (_) {
      // logging must never crash the host
    }
    if (level === 'error') console.error(line.trim());
  }

  resetAll() {
    this.data = defaults();
    this.save();
    return this.data;
  }
}

module.exports = Settings;
