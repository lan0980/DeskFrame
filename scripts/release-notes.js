#!/usr/bin/env node
'use strict';

// Pull one version's section out of CHANGELOG.md and turn it into release body text.
// Kept as a script rather than inline YAML so it can be run and checked locally.
//
//   node scripts/release-notes.js v1.0.0
//   node scripts/release-notes.js 1.0.0 -o release-notes.md

const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const outIdx = argv.indexOf('-o');
const outFile = outIdx >= 0 ? argv[outIdx + 1] : 'release-notes.md';
const raw = argv.find((a) => !a.startsWith('-') && a !== outFile) || '';

if (!raw) {
  console.error('usage: node scripts/release-notes.js <vX.Y.Z | X.Y.Z> [-o <file>]');
  process.exit(2);
}

const version = raw.replace(/^v/, '');
if (!/^\d+\.\d+\.\d+/.test(version)) {
  console.error(`release-notes: "${raw}" does not look like a version (expected v1.2.3)`);
  process.exit(2);
}

const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');
if (!fs.existsSync(changelogPath)) {
  console.error('release-notes: CHANGELOG.md not found');
  process.exit(1);
}

const lines = fs.readFileSync(changelogPath, 'utf8').split(/\r?\n/);
const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const heading = new RegExp(`^## \\[?v?${escaped}(?![\\d.])`);

const body = [];
let keeping = false;
for (const line of lines) {
  if (/^## /.test(line)) {
    if (keeping) break;             // the next version heading ends this section
    keeping = heading.test(line);
    continue;                       // the tag already shows the version, skip the heading
  }
  if (keeping) body.push(line);
}

if (!keeping) {
  console.error(`release-notes: CHANGELOG.md has no "## ${version}" section for ${raw}`);
  console.error('  headings found: ' + lines.filter((l) => /^## /.test(l)).join(' | '));
  process.exit(1);
}

const sha = process.env.GITHUB_SHA || 'local';
const text = `${body.join('\n').trim()}\n\n---\n构建自 commit \`${sha}\`。\n`;

fs.writeFileSync(outFile, text, 'utf8');
console.log(`release-notes: wrote ${outFile} (${text.length} chars) for v${version}`);
