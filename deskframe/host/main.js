'use strict';

const { app, BrowserWindow, Tray, Menu, nativeImage, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const Settings = require('./settings');
const WidgetRegistry = require('./widget-registry');
const Bridge = require('./bridge');

let settings = null;
let registry = null;
let tray = null;
let managerWin = null;

function safeLog(level, scope, err) {
  const text = err && err.stack ? err.stack : String(err);
  try {
    if (settings) settings.log(level, scope, text);
    else console.error(scope, text);
  } catch (_) {
    console.error(scope, text);
  }
}

process.on('uncaughtException', (err) => safeLog('error', 'uncaught', err));
process.on('unhandledRejection', (err) => safeLog('error', 'unhandled', err));

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => openManager());
  app.whenReady().then(bootstrap).catch((err) => safeLog('error', 'bootstrap', err));
}

// Widgets are windows too: closing the last window must not quit the host.
app.on('window-all-closed', () => {});
app.on('before-quit', () => {
  if (registry) registry.stop();
});

async function bootstrap() {
  settings = new Settings();
  settings.ensure();
  registry = new WidgetRegistry(settings);
  const bridge = new Bridge(registry, settings);
  bridge.register();
  await registry.start();
  createTray();
  openManager();
  settings.log('info', 'host', `started, widgets dir: ${settings.widgetsDir}`);
}

function openManager() {
  if (managerWin && !managerWin.isDestroyed()) {
    managerWin.focus();
    return;
  }
  managerWin = new BrowserWindow({
    width: 900,
    height: 640,
    minWidth: 720,
    minHeight: 480,
    title: 'DeskFrame · 小部件管理',
    webPreferences: {
      preload: path.join(__dirname, 'manager-preload.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      devTools: false
    }
  });
  managerWin.setMenu(null);
  managerWin.loadFile(path.join(__dirname, 'manager.html'));
  managerWin.on('closed', () => { managerWin = null; });
}

function createTray() {
  try {
    const iconPath = path.join(__dirname, 'assets', 'tray.png');
    const image = fs.existsSync(iconPath)
      ? nativeImage.createFromPath(iconPath)
      : nativeImage.createEmpty();
    tray = new Tray(image);
    tray.setToolTip('DeskFrame');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: '打开管理界面', click: () => openManager() },
      { label: '打开小部件目录', click: () => shell.openPath(settings.widgetsDir) },
      { label: '打开日志目录', click: () => shell.openPath(settings.logsDir) },
      { type: 'separator' },
      { label: '退出 DeskFrame', click: () => app.quit() }
    ]));
    tray.on('double-click', () => openManager());
  } catch (err) {
    safeLog('warn', 'tray', `tray unavailable (manager window still works): ${err.message}`);
  }
}
