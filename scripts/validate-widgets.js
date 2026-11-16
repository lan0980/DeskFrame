#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'widgets');
const PROTOCOL = 1;
// Must stay identical to ALLOWED_PERMISSIONS in host/widget-registry.js — the cloud
// gate and the runtime gate have to agree, or a widget can pass CI yet be denied at
// runtime (or, worse, the reverse).
const ALLOWED_PERMISSIONS = new Set([
  'config.read',
  'config.write',
  'system.time',
  'system.info',
  'clipboard.read',
  'clipboard.write',
  'open-external',
  'widget.resize',
  'log',
  'network',
  'bus',
  'badge'
]);

const ALLOWED_SCHEMA_TYPES = new Set(['boolean', 'string', 'number', 'enum', 'color']);
const ID_RE = /^[a-z0-9][a-z0-9_-]{0,47}$/;

const errors = [];
let checked = 0;

function fail(file, msg) {
  errors.push(`${file}: ${msg}`);
}

function isInside(base, target) {
  const rel = path.relative(base, target);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

if (!fs.existsSync(ROOT)) {
  console.log('No widgets directory. Nothing to validate.');
  process.exit(0);
}

const folders = fs.readdirSync(ROOT, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== '_template')
  .map((d) => d.name);

for (const name of folders) {
  const dir = path.join(ROOT, name);
  const manifestPath = path.join(dir, 'widget.json');

  if (!fs.existsSync(manifestPath)) {
    fail(name, 'missing widget.json');
    continue;
  }

  let m;
  try {
    m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (e) {
    fail(name, `widget.json is not valid JSON (${e.message})`);
    continue;
  }

  checked += 1;

  if (m.protocol !== PROTOCOL) fail(name, `protocol must be ${PROTOCOL}`);
  if (!ID_RE.test(m.id || '')) fail(name, 'id must match ^[a-z0-9][a-z0-9_-]{0,47}$');
  if (m.id !== name) fail(name, `id "${m.id}" must equal folder name "${name}"`);
  if (typeof m.name !== 'string' || !m.name.trim()) fail(name, 'name is required');
  if (!/^\d+\.\d+\.\d+$/.test(m.version || '')) fail(name, 'version must be semver x.y.z');
  if (typeof m.entry !== 'string' || !m.entry.trim()) fail(name, 'entry is required');

  const entryPath = path.resolve(dir, m.entry);
  if (!isInside(path.resolve(dir), entryPath)) fail(name, 'entry escapes the widget folder');
  if (!fs.existsSync(entryPath)) fail(name, `entry file not found: ${m.entry}`);

  if (m.permissions !== undefined) {
    if (!Array.isArray(m.permissions)) {
      fail(name, 'permissions must be an array');
    } else {
      for (const p of m.permissions) {
        if (!ALLOWED_PERMISSIONS.has(p)) fail(name, `unknown permission "${p}"`);
      }
      if (m.permissions.includes('network')) {
        console.log(`note: ${name} declares "network" - the host keeps it OFF until the user opts in.`);
      }
    }
  }

  if (m.window) {
    const w = m.window;
    for (const key of ['width', 'height']) {
      if (w[key] !== undefined && (!Number.isFinite(w[key]) || w[key] < 32 || w[key] > 4096)) {
        fail(name, `window.${key} must be between 32 and 4096`);
      }
    }
    for (const key of ['transparent', 'frame', 'alwaysOnTop', 'clickThrough', 'resizable']) {
      if (w[key] !== undefined && typeof w[key] !== 'boolean') {
        fail(name, `window.${key} must be a boolean`);
      }
    }
  }

  if (m.configSchema) {
    if (typeof m.configSchema !== 'object' || Array.isArray(m.configSchema)) {
      fail(name, 'configSchema must be an object');
    } else {
      for (const [key, def] of Object.entries(m.configSchema)) {
        if (!ALLOWED_SCHEMA_TYPES.has(def.type)) fail(name, `configSchema.${key}.type is invalid`);
        if (def.type === 'enum' && !Array.isArray(def.options)) {
          fail(name, `configSchema.${key} (enum) needs an options array`);
        }
        if (def.default === undefined) fail(name, `configSchema.${key} needs a default`);
      }
    }
  }
}

if (errors.length) {
  console.error(`Validation failed for ${checked} widget(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(`OK: ${checked} widget(s) validated. Template folder skipped.`);
