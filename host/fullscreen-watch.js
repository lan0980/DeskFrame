'use strict';

// Detects whether the foreground window covers a whole display, so widgets can get
// out of the way during games / presentations / full-screen video.
//
// Implemented as one long-lived PowerShell child that reads user32 (GetForegroundWindow
// + GetWindowRect + GetClassName) — Electron exposes no cross-process foreground query.
// The script reaches PowerShell through -EncodedCommand (UTF-16LE base64) so no quoting
// is ever re-parsed, and nothing is written to disk.
//
// It reads public window geometry only: no injection into other processes, no global
// hooks, no elevation. On non-Windows platforms it stays inert.

const { EventEmitter } = require('events');
const { spawn } = require('child_process');

const POLL_MS = 900;
const MAX_RESTARTS = 3;

const PS_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Windows.Forms
$src = @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public class DFNative {
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern int GetClassName(IntPtr h, StringBuilder s, int max);
}
'@
Add-Type -TypeDefinition $src
# Align .NET screen coordinates with window coordinates so 125%/150% scaling cannot skew them.
[void][DFNative]::SetProcessDPIAware()
$skip = @('Progman', 'WorkerW', 'Shell_TrayWnd', 'Windows.UI.Core.CoreWindow')
$prev = ''
while ($true) {
  $full = $false
  $h = [DFNative]::GetForegroundWindow()
  if ($h -ne [IntPtr]::Zero -and -not [DFNative]::IsIconic($h)) {
    $cls = New-Object System.Text.StringBuilder 256
    [void][DFNative]::GetClassName($h, $cls, 255)
    if (-not $skip.Contains($cls.ToString())) {
      $r = New-Object DFNative+RECT
      if ([DFNative]::GetWindowRect($h, [ref]$r)) {
        foreach ($s in [System.Windows.Forms.Screen]::AllScreens) {
          $b = $s.Bounds
          if ($r.Left -le $b.X -and $r.Top -le $b.Y -and $r.Right -ge ($b.X + $b.Width) -and $r.Bottom -ge ($b.Y + $b.Height)) {
            $full = $true
            break
          }
        }
      }
    }
  }
  $now = '0'
  if ($full) { $now = '1' }
  if ($now -ne $prev) {
    $prev = $now
    Write-Output $now
    [Console]::Out.Flush()
  }
  Start-Sleep -Milliseconds ${POLL_MS}
}
`;

function encodeCommand(script) {
  return Buffer.from(script, 'utf16le').toString('base64');
}

class FullscreenWatcher extends EventEmitter {
  constructor(log) {
    super();
    this.log = log || (() => {});
    this.child = null;
    this.enabled = false;
    this.fullscreen = false;
    this.reason = '';
    this.restarts = 0;
    this.buffer = '';
    this.stopped = false;
  }

  // Surfaced in the manager UI so a switch that cannot work never looks like it can.
  status() {
    return {
      supported: process.platform === 'win32',
      enabled: this.enabled,
      active: this.fullscreen,
      running: !!this.child,
      reason: this.reason
    };
  }

  start() {
    if (process.platform !== 'win32') {
      this.reason = 'only supported on Windows';
      return false;
    }
    if (this.child) return true;
    this.enabled = true;
    this.stopped = false;
    this.restarts = 0;
    return this.spawnChild();
  }

  spawnChild() {
    try {
      this.child = spawn('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy', 'Bypass',
        '-EncodedCommand', encodeCommand(PS_SCRIPT)
      ], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (err) {
      this.reason = `spawn failed: ${err.message}`;
      this.log('warn', 'fullscreen', this.reason);
      return false;
    }

    this.child.stdout.setEncoding('utf8');
    this.child.stdout.on('data', (chunk) => this.consume(chunk));

    this.child.stderr.setEncoding('utf8');
    let stderrSeen = '';
    this.child.stderr.on('data', (chunk) => { stderrSeen += chunk; });

    this.child.on('error', (err) => {
      this.reason = `powershell unavailable: ${err.message}`;
      this.child = null;
      this.log('warn', 'fullscreen', this.reason);
    });

    this.child.on('exit', (code) => {
      this.child = null;
      if (this.stopped || !this.enabled) return;
      if (stderrSeen.trim()) this.log('warn', 'fullscreen', stderrSeen.trim().slice(0, 400));
      if (this.restarts < MAX_RESTARTS) {
        this.restarts += 1;
        this.log('warn', 'fullscreen', `watcher exited (code ${code}), restart ${this.restarts}/${MAX_RESTARTS}`);
        setTimeout(() => { if (this.enabled && !this.stopped) this.spawnChild(); }, 3000);
        return;
      }
      this.reason = `watcher stopped after ${MAX_RESTARTS} restarts`;
      this.log('warn', 'fullscreen', this.reason);
      this.setFullscreen(false);
    });

    this.reason = '';
    return true;
  }

  consume(chunk) {
    this.buffer += chunk;
    let idx;
    while ((idx = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, idx).trim();
      this.buffer = this.buffer.slice(idx + 1);
      if (line === '1') this.setFullscreen(true);
      else if (line === '0') this.setFullscreen(false);
    }
  }

  setFullscreen(value) {
    if (this.fullscreen === value) return;
    this.fullscreen = value;
    this.emit('change', value);
  }

  stop() {
    this.enabled = false;
    this.stopped = true;
    this.buffer = '';
    if (this.fullscreen) {
      this.fullscreen = false;
      this.emit('change', false);
    }
    if (this.child) {
      const child = this.child;
      this.child = null;
      try { child.kill(); } catch (_) { /* already gone */ }
    }
  }
}

module.exports = FullscreenWatcher;
module.exports.encodeCommand = encodeCommand;
