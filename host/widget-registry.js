'use strict';

const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const AdmZip = require('adm-zip');
const WidgetWindow = require('./widget-window');

const PROTOCOL = 1;
const ID_RE = /^[a-z0-9][a-z0-9_-]{0,47}$/;
const ALLOWED_PERMISSIONS = new Set([
  'config.read', 'config.write', 'system.time', 'system.info',
  'clipboard.read', 'clipboard.write', 'open-external',
  'widget.resize', 'log', 'network'
]);
const MAX_FAILURES = 5;
const FAILURE_WINDOW_MS = 60000;

function isInside(base, target) {
  const rel = path.relative(base, target);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

class WidgetRegistry extends EventEmitter {
  constructor(settings) {
    super();
    this.settings = settings;
    this.dir = settings.widgetsDir;
    this.manifests = new Map();
    this.instances = new Map();
    this.failures = new Map();
    this.quarantine = new Set();
    this.watcher = null;
    this.watchTimer = null;
  }

  async start() {
    fs.mkdirSync(this.dir, { recursive: true });
    this.scan();
    for (const [id, rec] of this.manifests) {
      const st = this.settings.ensureWidgetState(id, rec.manifest);
      if (st.enabled) this.spawn(id);
    }
    this.watch();
  }

  validate(m, folderName, folder) {
    if (!m || m.protocol !== PROTOCOL) return `protocol must be ${PROTOCOL}`;
    if (!ID_RE.test(m.id || '')) return 'invalid id';
    if (folderName && m.id !== folderName) return `id "${m.id}" must equal folder name "${folderName}"`;
    if (typeof m.name !== 'string' || !m.name.trim()) return 'name is required';
    if (!/^\d+\.\d+\.\d+$/.test(m.version || '')) return 'version must be x.y.z';
    if (m.permissions !== undefined) {
      if (!Array.isArray(m.permissions)) return 'permissions must be an array';
      for (const p of m.permissions) {
        if (!ALLOWED_PERMISSIONS.has(p)) return `unknown permission "${p}"`;
      }
    }
    const entry = path.resolve(folder, m.entry || 'index.html');
    if (!isInside(path.resolve(folder), entry)) return 'entry escapes the widget folder';
    if (!fs.existsSync(entry)) return `entry not found: ${m.entry}`;
    return null;
  }

  scan() {
    const found = new Set();
    let entries = [];
    try {
      entries = fs.readdirSync(this.dir, { withFileTypes: true });
    } catch (err) {
      this.settings.log('error', 'registry', err.message);
      return;
    }
    for (const ent of entries) {
      if (!ent.isDirectory() || ent.name.startsWith('.')) continue;
      const folder = path.join(this.dir, ent.name);
      const mf = path.join(folder, 'widget.json');
      if (!fs.existsSync(mf)) {
        this.settings.log('warn', 'registry', `${ent.name}: no widget.json, skipped`);
        continue;
      }
      let m;
      try {
        m = JSON.parse(fs.readFileSync(mf, 'utf8'));
      } catch (err) {
        this.settings.log('error', 'registry', `${ent.name}: bad widget.json: ${err.message}`);
        continue;
      }
      const problem = this.validate(m, ent.name, folder);
      if (problem) {
        this.settings.log('error', 'registry', `${ent.name}: ${problem} (quarantined)`);
        continue;
      }
      found.add(m.id);
      this.manifests.set(m.id, { id: m.id, folder, manifest: m });
    }
    for (const id of Array.from(this.manifests.keys())) {
      if (!found.has(id)) this.manifests.delete(id);
    }
    this.emit('changed');
  }

  spawn(id) {
    if (this.instances.has(id) || this.quarantine.has(id)) return;
    const rec = this.manifests.get(id);
    if (!rec) return;
    const state = this.settings.ensureWidgetState(id, rec.manifest);
    try {
      const inst = new WidgetWindow({
        id, folder: rec.folder, manifest: rec.manifest, state, settings: this.settings,
        onGone: (wid, reason) => this.handleGone(wid, reason),
        onReady: (wid) => this.settings.log('info', wid, 'ready'),
        onBounds: (wid, bounds) => this.settings.setWidgetState(wid, bounds)
      });
      this.instances.set(id, inst);
      inst.create();
      this.settings.log('info', id, 'loaded');
    } catch (err) {
      this.instances.delete(id);
      this.settings.log('error', id, `spawn failed: ${err.message}`);
      this.quarantine.add(id);
      this.emit('changed');
    }
  }

  handleGone(id, reason) {
    this.instances.delete(id);
    this.settings.log('error', id, `widget stopped: ${reason}`);
    const now = Date.now();
    const rec = this.failures.get(id) || { times: [] };
    rec.times = rec.times.filter((t) => now - t < FAILURE_WINDOW_MS);
    rec.times.push(now);
    this.failures.set(id, rec);
    const st = this.settings.widgetState(id);
    if (!st || !st.enabled) {
      this.emit('changed');
      return;
    }
    if (rec.times.length > MAX_FAILURES) {
      this.quarantine.add(id);
      this.settings.log('error', id, 'more than 5 failures in 60s, quarantined');
      this.emit('changed');
      return;
    }
    const delay = Math.min(8000, 500 * Math.pow(2, rec.times.length - 1));
    setTimeout(() => {
      const cur = this.settings.widgetState(id);
      if (!this.quarantine.has(id) && cur && cur.enabled && this.manifests.has(id)) this.spawn(id);
    }, delay);
  }

  getByWindow(win) {
    if (!win) return null;
    for (const inst of this.instances.values()) {
      if (inst.win === win) return inst;
    }
    return null;
  }

  list() {
    const out = [];
    for (const [id, rec] of this.manifests) {
      const st = this.settings.widgetState(id) || {};
      out.push({
        id,
        name: rec.manifest.name,
        version: rec.manifest.version,
        description: rec.manifest.description || '',
        permissions: rec.manifest.permissions || [],
        configSchema: rec.manifest.configSchema || {},
        config: st.config || {},
        enabled: !!st.enabled,
        running: this.instances.has(id),
        quarantined: this.quarantine.has(id),
        state: st
      });
    }
    return out;
  }

  enable(id) {
    this.quarantine.delete(id);
    this.failures.delete(id);
    this.settings.setWidgetState(id, { enabled: true });
    this.spawn(id);
    return this.list();
  }

  disable(id) {
    this.settings.setWidgetState(id, { enabled: false });
    const inst = this.instances.get(id);
    if (inst) {
      inst.destroy();
      this.instances.delete(id);
    }
    return this.list();
  }

  reload(id) {
    const inst = this.instances.get(id);
    if (!inst) return this.list();
    inst.destroy();
    this.instances.delete(id);
    this.spawn(id);
    return this.list();
  }

  uninstall(id) {
    this.disable(id);
    const rec = this.manifests.get(id);
    if (rec) {
      try { fs.rmSync(rec.folder, { recursive: true, force: true }); }
      catch (err) { this.settings.log('error', id, `remove folder failed: ${err.message}`); }
    }
    this.manifests.delete(id);
    this.settings.removeWidget(id);
    this.scan();
    return this.list();
  }

  findRoot(dir) {
    if (fs.existsSync(path.join(dir, 'widget.json'))) return dir;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ent.isDirectory() && fs.existsSync(path.join(dir, ent.name, 'widget.json'))) {
        return path.join(dir, ent.name);
      }
    }
    throw new Error('widget.json not found in package');
  }

  installZip(zipPath) {
    const staging = path.join(this.dir, `.staging-${Date.now()}`);
    fs.mkdirSync(staging, { recursive: true });
    try {
      const zip = new AdmZip(zipPath);
      for (const entry of zip.getEntries()) {
        const target = path.resolve(staging, entry.entryName);
        if (!isInside(path.resolve(staging), target)) throw new Error('unsafe path inside zip');
      }
      zip.extractAllTo(staging, true);
      const root = this.findRoot(staging);
      const m = JSON.parse(fs.readFileSync(path.join(root, 'widget.json'), 'utf8'));
      const problem = this.validate(m, null, root);
      if (problem) throw new Error(problem);
      const finalDir = path.join(this.dir, m.id);
      if (fs.existsSync(finalDir)) {
        this.disable(m.id);
        fs.rmSync(finalDir, { recursive: true, force: true });
      }
      fs.renameSync(root, finalDir);
      fs.rmSync(staging, { recursive: true, force: true });
      this.scan();
      const st = this.settings.ensureWidgetState(m.id, m);
      if (st.enabled) this.spawn(m.id);
      this.settings.log('info', m.id, `installed from ${path.basename(zipPath)}`);
      return { id: m.id };
    } catch (err) {
      try { fs.rmSync(staging, { recursive: true, force: true }); } catch (_) { /* ignore */ }
      throw err;
    }
  }

  addFolder(src) {
    const mf = path.join(src, 'widget.json');
    if (!fs.existsSync(mf)) throw new Error('selected folder has no widget.json');
    const m = JSON.parse(fs.readFileSync(mf, 'utf8'));
    const problem = this.validate(m, null, src);
    if (problem) throw new Error(problem);
    const finalDir = path.join(this.dir, m.id);
    if (fs.existsSync(finalDir)) {
      this.disable(m.id);
      fs.rmSync(finalDir, { recursive: true, force: true });
    }
    fs.cpSync(src, finalDir, { recursive: true });
    this.scan();
    const st = this.settings.ensureWidgetState(m.id, m);
    if (st.enabled) this.spawn(m.id);
    return { id: m.id };
  }

  watch() {
    try {
      this.watcher = fs.watch(this.dir, { persistent: false }, () => {
        clearTimeout(this.watchTimer);
        this.watchTimer = setTimeout(() => this.rescanHotplug(), 300);
      });
    } catch (err) {
      this.settings.log('warn', 'registry', `directory watch unavailable: ${err.message}`);
    }
  }

  rescanHotplug() {
    const before = new Set(this.manifests.keys());
    this.scan();
    const after = new Set(this.manifests.keys());
    for (const id of after) {
      if (!before.has(id)) {
        const st = this.settings.ensureWidgetState(id, this.manifests.get(id).manifest);
        if (st.enabled) this.spawn(id);
        this.settings.log('info', id, 'hot-plugged in');
      }
    }
    for (const id of before) {
      if (!after.has(id)) {
        const inst = this.instances.get(id);
        if (inst) {
          inst.destroy();
          this.instances.delete(id);
        }
        this.settings.removeWidget(id);
        this.settings.log('info', id, 'hot-unplugged');
      }
    }
  }

  stop() {
    if (this.watcher) this.watcher.close();
    clearTimeout(this.watchTimer);
    for (const inst of this.instances.values()) inst.destroy();
    this.instances.clear();
  }
}

module.exports = WidgetRegistry;
