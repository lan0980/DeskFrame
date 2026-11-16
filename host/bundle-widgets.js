'use strict';

// Hands out the widgets that ship inside the app on first run.
//
// The bundled sources live next to the app (inside app.asar once packaged), while the
// user's widget directory is plain disk. So copying is done with explicit
// readdir/readFile/writeFile calls instead of fs.cpSync — the recursive copy helper is
// not dependable when the source sits inside an asar archive, and a half-copied widget
// would look exactly like a broken one.

const fs = require('fs');
const path = require('path');

const SKIP = new Set(['_template']);

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {
    return null;
  }
}

function copyTree(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, ent.name);
    const to = path.join(dest, ent.name);
    if (ent.isDirectory()) copyTree(from, to);
    else fs.writeFileSync(to, fs.readFileSync(from));
  }
}

class BundleSeeder {
  constructor({ sourceDir, targetDir, settings, appVersion, log }) {
    this.sourceDir = sourceDir;
    this.targetDir = targetDir;
    this.settings = settings;
    this.appVersion = appVersion;
    this.log = log || (() => {});
  }

  available() {
    try {
      return fs.existsSync(this.sourceDir) && fs.statSync(this.sourceDir).isDirectory();
    } catch (_) {
      return false;
    }
  }

  // Ids of the widgets that ship with this build. Used to decide whether an uninstall
  // should be remembered so the widget does not come back on the next launch.
  ids() {
    const out = [];
    if (!this.available()) return out;
    let entries = [];
    try {
      entries = fs.readdirSync(this.sourceDir, { withFileTypes: true });
    } catch (_) {
      return out;
    }
    for (const ent of entries) {
      if (!ent.isDirectory() || SKIP.has(ent.name) || ent.name.startsWith('.')) continue;
      const m = readJson(path.join(this.sourceDir, ent.name, 'widget.json'));
      if (!m || typeof m.id !== 'string' || m.id !== ent.name) continue;
      out.push(m.id);
    }
    return out;
  }

  seed() {
    const result = { seeded: [], skippedRemoved: [], alreadyPresent: [], failed: [] };
    if (!this.available()) {
      this.log('info', 'bundle', 'no bundled widgets in this build');
      return result;
    }

    const removed = this.settings.bundleRemoved();
    for (const id of this.ids()) {
      const dest = path.join(this.targetDir, id);
      if (removed.has(id)) {
        result.skippedRemoved.push(id);
        continue;
      }
      if (fs.existsSync(dest)) {
        result.alreadyPresent.push(id);
        continue;
      }
      try {
        copyTree(path.join(this.sourceDir, id), dest);
        result.seeded.push(id);
      } catch (err) {
        result.failed.push({ id, message: err.message });
        this.log('error', 'bundle', `seeding ${id} failed: ${err.message}`);
        // Never leave a partial widget behind.
        try { fs.rmSync(dest, { recursive: true, force: true }); } catch (_) { /* ignore */ }
      }
    }

    if (result.seeded.length || result.alreadyPresent.length) {
      this.settings.markBundleSeeded(this.appVersion);
    }
    if (result.seeded.length) {
      this.log('info', 'bundle', `seeded ${result.seeded.length} bundled widget(s) for ${this.appVersion}`);
    }
    return result;
  }
}

module.exports = BundleSeeder;
