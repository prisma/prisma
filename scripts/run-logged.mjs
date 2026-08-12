#!/usr/bin/env node
// Runs one slow command (a pnpm `:agent` script) with its combined output
// captured to a timestamped `wip/<logname>.<ts>.log`, its exit code mirrored to
// a sibling `.exit` file, and a hard timeout. If the command hangs — e.g.
// vitest freezes after printing its summary — the child process group is killed
// and `.exit` records `124`, so the run fails loudly instead of blocking forever.
// Usage: node scripts/run-logged.mjs <logname> <command> [args...]
import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { cwd, env, exit, pid } from 'node:process';

const [logname, command, ...args] = process.argv.slice(2);

if (!logname || !command) {
  process.stderr.write('Usage: node scripts/run-logged.mjs <logname> <command> [args...]\n');
  exit(1);
}

const requestedTimeout = Number(env.AGENT_CMD_TIMEOUT_SECONDS ?? 300);
const timeoutSeconds =
  Number.isFinite(requestedTimeout) && requestedTimeout > 0 ? requestedTimeout : 300;
if (timeoutSeconds !== requestedTimeout) {
  process.stderr.write(
    `run-logged: ignoring invalid AGENT_CMD_TIMEOUT_SECONDS=${env.AGENT_CMD_TIMEOUT_SECONDS}; using ${timeoutSeconds}s\n`,
  );
}

const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const timestamp =
  `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
  `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

const wipDir = resolve(cwd(), 'wip');
mkdirSync(wipDir, { recursive: true });

const basename = `${logname}.${timestamp}.${pid}`;
const logPath = join(wipDir, `${basename}.log`);
const exitPath = join(wipDir, `${basename}.exit`);
const relLogPath = `wip/${basename}.log`;

process.stdout.write(`log: ${relLogPath}\n`);

const logStream = createWriteStream(logPath, { flags: 'a' });

const child = spawn(command, args, {
  detached: true,
  stdio: ['ignore', 'pipe', 'pipe'],
});

child.stdout?.pipe(logStream, { end: false });
child.stderr?.pipe(logStream, { end: false });

let finished = false;

function finish(code) {
  if (finished) return;
  finished = true;
  clearTimeout(timer);
  logStream.end(() => {
    writeFileSync(exitPath, `${code}\n`);
    exit(code);
  });
}

const timer = setTimeout(() => {
  try {
    process.kill(-child.pid, 'SIGKILL');
  } catch {
    // child may have already exited
  }
  logStream.write(`\n[run-logged] TIMEOUT after ${timeoutSeconds}s — killed child\n`);
  finish(124);
}, timeoutSeconds * 1000);

child.on('error', (err) => {
  logStream.write(`\n[run-logged] failed to spawn: ${err.message}\n`);
  finish(127);
});

child.on('close', (code) => {
  finish(code ?? 1);
});
