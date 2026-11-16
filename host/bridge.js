'use strict';

const { ipcMain, BrowserWindow, dialog, shell, clipboard, app } = require('electron');
const os = require('os');

const MAX_MESSAGE = 1024 * 1024;
const MAX_EVENT_NAME = 64;
const MAX_BADGE = 24;

// Every widget-facing method must be listed here; a method missing from this map is
// rejected outright, so an unknown IPC call can never fall through to a wrong branch.
const METHOD_PERMISSION = {
  ready: null,
  close: null,
  getConfig: 'config.read',
  getState: 'config.read',
  setConfig: 'config.write',
  systemInfo: 'system.info',
  clipboardRead: 'clipboard.read',
  clipboardWrite: 'clipboard.write',
  openExternal: 'open-external',
  resize: 'widget.resize',
  setOpacity: 'widget.resize',
  setClickThrough: 'widget.resize',
  setBadge: 'badge',
  emit: 'bus',
  log: 'log'
};

class Bridge {
  constructor(registry, settings) {
    this.registry = registry;
    this.settings = settings;
  }

  register() {
    ipcMain.handle('df:call', (event, req) => this.handleWidgetCall(event, req));
    ipcMain.handle('df:manager', (event, req) => this.handleManagerCall(event, req));
  }

  assertPermission(inst, need) {
    if (!need) return;
    const perms = inst.manifest.permissions || [];
    if (!perms.includes(need)) throw new Error(`permission denied: ${need}`);
    if (need === 'network' && !this.settings.getGlobal().allowNetwork) {
      throw new Error('network is disabled by the user');
    }
  }

  handleWidgetCall(event, req) {
    if (!req || typeof req.method !== 'string') throw new Error('bad request');
    if (JSON.stringify(req).length > MAX_MESSAGE) throw new Error('message exceeds 1 MB');
    const win = BrowserWindow.fromWebContents(event.sender);
    const inst = this.registry.getByWindow(win);
    if (!inst) throw new Error('unknown widget instance');

    const method = req.method;
    if (!Object.prototype.hasOwnProperty.call(METHOD_PERMISSION, method)) {
      throw new Error(`unknown method: ${method}`);
    }
    this.assertPermission(inst, METHOD_PERMISSION[method]);
    const args = Array.isArray(req.args) ? req.args : [];
    const id = inst.id;

    switch (method) {
      case 'ready':
        inst.markReady();
        return { ok: true, id };

      case 'getConfig':
        return (this.settings.widgetState(id) || {}).config || {};

      case 'getState': {
        const st = this.settings.widgetState(id) || {};
        return {
          enabled: !!st.enabled,
          size: st.size,
          opacity: st.opacity,
          clickThrough: st.clickThrough,
          alwaysOnTop: st.alwaysOnTop,
          locked: !!st.locked,
          badge: st.badge || ''
        };
      }

      case 'setConfig': {
        const partial = args[0];
        if (!partial || typeof partial !== 'object' || Array.isArray(partial)) throw new Error('config must be an object');
        const schema = inst.manifest.configSchema || {};
        const clean = {};
        for (const [k, v] of Object.entries(partial)) {
          if (!schema[k]) continue;
          const t = schema[k].type;
          if (t === 'boolean' && typeof v !== 'boolean') continue;
          if ((t === 'string' || t === 'color') && typeof v !== 'string') continue;
          if (t === 'number' && typeof v !== 'number') continue;
          if (t === 'enum' && !(schema[k].options || []).includes(v)) continue;
          clean[k] = v;
        }
        const config = this.settings.setWidgetConfig(id, clean);
        inst.send('config', config);
        return config;
      }

      case 'systemInfo':
        return {
          platform: process.platform,
          arch: process.arch,
          cpus: os.cpus().length,
          uptimeSeconds: Math.round(os.uptime()),
          freeMemoryBytes: os.freemem(),
          totalMemoryBytes: os.totalmem()
        };

      case 'clipboardRead':
        return clipboard.readText();

      case 'clipboardWrite':
        clipboard.writeText(String(args[0] || '').slice(0, 100000));
        return true;

      case 'openExternal': {
        const url = String(args[0] || '');
        if (!/^https?:\/\//i.test(url)) throw new Error('only http/https URLs are allowed');
        shell.openExternal(url);
        return true;
      }

      case 'resize': {
        const w = Math.min(4096, Math.max(32, Number(args[0]) || 320));
        const h = Math.min(4096, Math.max(32, Number(args[1]) || 200));
        if (inst.win && !inst.win.isDestroyed()) inst.win.setSize(w, h);
        this.settings.setWidgetState(id, { size: { w, h } });
        return { w, h };
      }

      case 'setOpacity': {
        const v = Math.min(1, Math.max(0.1, Number(args[0]) || 1));
        if (inst.win && !inst.win.isDestroyed()) inst.win.setOpacity(v);
        this.settings.setWidgetState(id, { opacity: v });
        return v;
      }

      case 'setClickThrough': {
        const v = !!args[0];
        if (inst.win && !inst.win.isDestroyed()) inst.win.setIgnoreMouseEvents(v, { forward: true });
        this.settings.setWidgetState(id, { clickThrough: v });
        return v;
      }

      // The badge is persisted on widget state and shown by the manager window, so a
      // widget can leave a visible status marker without drawing any chrome itself.
      case 'setBadge': {
        const raw = args[0];
        const text = (raw === null || raw === undefined || raw === false)
          ? ''
          : String(raw).slice(0, MAX_BADGE);
        this.settings.setWidgetState(id, { badge: text });
        this.registry.emit('changed');
        return true;
      }

      // Message bus: fan the event out to every running widget that declared `bus`,
      // excluding the sender so a widget never sees the echo of its own emit().
      case 'emit': {
        const name = String(args[0] || '').trim().slice(0, MAX_EVENT_NAME);
        if (!name) throw new Error('event name is required');
        const payload = args.length > 1 ? args[1] : null;
        const encoded = JSON.stringify(payload);
        if (encoded === undefined) throw new Error('payload must be JSON-serializable');
        if (encoded.length > MAX_MESSAGE) throw new Error('payload exceeds 1 MB');
        const delivered = this.registry.broadcast(id, name, payload);
        return { name, delivered };
      }

      case 'log':
        this.settings.log(String(args[0] || 'info'), id, String(args[1] || '').slice(0, 4000));
        return true;

      case 'close':
        inst.hideByWidget();
        return true;

      default:
        throw new Error(`unhandled method: ${method}`);
    }
  }

  async handleManagerCall(event, req) {
    const method = req && req.method;
    const p = (req && req.payload) || {};
    const parent = BrowserWindow.fromWebContents(event.sender);

    switch (method) {
      case 'list':
        return this.registry.list();

      case 'getInfo':
        return {
          version: app.getVersion(),
          widgetsDir: this.settings.widgetsDir,
          logsDir: this.settings.logsDir,
          settingsFile: this.settings.file,
          global: this.settings.getGlobal(),
          fullscreen: this.registry.fullscreenStatus()
        };

      case 'getGlobal':
        return this.settings.getGlobal();

      case 'setGlobal': {
        const allowed = {};
        for (const k of ['autoHideOnFullscreen', 'launchAtLogin', 'allowNetwork']) {
          if (typeof p[k] === 'boolean') allowed[k] = p[k];
        }
        const g = this.settings.setGlobal(allowed);
        if (typeof allowed.launchAtLogin === 'boolean') {
          try {
            app.setLoginItemSettings({ openAtLogin: allowed.launchAtLogin, path: process.execPath });
          } catch (err) {
            this.settings.log('warn', 'manager', `autostart unavailable: ${err.message}`);
          }
        }
        // The watcher only earns its cost while the user actually wants the hiding.
        if (Object.prototype.hasOwnProperty.call(allowed, 'autoHideOnFullscreen')) {
          this.registry.setFullscreenPreference(g.autoHideOnFullscreen);
        }
        return g;
      }

      case 'installZip': {
        const picked = await dialog.showOpenDialog(parent, {
          title: '选择 .widget.zip 小部件包',
          filters: [{ name: 'Widget package', extensions: ['zip'] }],
          properties: ['openFile']
        });
        if (picked.canceled || !picked.filePaths.length) return { canceled: true };
        return this.registry.installZip(picked.filePaths[0]);
      }

      case 'addFolder': {
        const picked = await dialog.showOpenDialog(parent, {
          title: '选择包含 widget.json 的文件夹',
          properties: ['openDirectory']
        });
        if (picked.canceled || !picked.filePaths.length) return { canceled: true };
        return this.registry.addFolder(picked.filePaths[0]);
      }

      case 'enable':
        return this.registry.enable(p.id);
      case 'disable':
        return this.registry.disable(p.id);
      case 'reload':
        return this.registry.reload(p.id);
      case 'uninstall':
        return this.registry.uninstall(p.id);

      case 'setConfig': {
        const inst = this.registry.instances.get(p.id);
        if (inst) inst.send('config', p.config || {});
        this.settings.setWidgetConfig(p.id, p.config || {});
        return this.registry.list();
      }

      case 'setWidgetState': {
        const inst = this.registry.instances.get(p.id);
        const allowed = {};
        for (const k of ['opacity', 'clickThrough', 'alwaysOnTop', 'locked']) {
          if (p[k] !== undefined) allowed[k] = p[k];
        }
        this.settings.setWidgetState(p.id, allowed);
        if (inst) inst.applyState(allowed);
        return this.registry.list();
      }

      case 'openWidgetsDir':
        shell.openPath(this.settings.widgetsDir);
        return true;
      case 'openLogsDir':
        shell.openPath(this.settings.logsDir);
        return true;

      case 'reset': {
        this.registry.stop();
        this.settings.resetAll();
        this.registry.quarantine.clear();
        // "Restore defaults" also means handing back the factory set, including bundled
        // widgets the user had removed: resetAll cleared the removal record just now.
        this.registry.bundle.seed();
        this.registry.scan();

        for (const [id, rec] of this.registry.manifests) {
          const st = this.settings.ensureWidgetState(id, rec.manifest);
          if (st.enabled) this.registry.spawn(id);
        }
        this.registry.watch();
        this.registry.setFullscreenPreference(this.settings.getGlobal().autoHideOnFullscreen);
        return this.settings.getGlobal();
      }

      default:
        throw new Error(`unknown manager method: ${method}`);
    }
  }
}

module.exports = Bridge;
