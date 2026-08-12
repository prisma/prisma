import { spawn } from 'node:child_process';
import type { PackageManagerRunner } from '@prisma/cli-engine';

/** How much of the child's stderr a failure carries, matching the engine's bound. */
const STDERR_TAIL_BYTES = 64 * 1024;

/** A manager that could not be launched at all reports the same as one that failed. */
const LAUNCH_FAILURE_EXIT_CODE = 1;

/**
 * Runs the package-manager invocation the engine composed. This is the bin's
 * half of the capability: the engine chooses the manager and spells the argv,
 * and never imports a child-process module of its own.
 */
export const runPackageManager: PackageManagerRunner = (request) =>
  new Promise((resolve) => {
    const child = spawn(request.file, [...request.args], {
      cwd: request.cwd,
      signal: request.signal,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Bounded while the child runs, not just at settlement — a manager with
    // runaway diagnostics must not grow the buffer without limit.
    let stderr = '';
    const keepTail = (chunk: string): void => {
      stderr = (stderr + chunk).slice(-STDERR_TAIL_BYTES);
    };
    const settle = (exitCode: number): void => {
      resolve({ exitCode, stderr });
    };

    child.stdout?.setEncoding('utf-8');
    child.stdout?.on('data', (chunk: string) => request.onOutput('data', chunk));
    child.stderr?.setEncoding('utf-8');
    child.stderr?.on('data', (chunk: string) => {
      keepTail(chunk);
      request.onOutput('diagnostic', chunk);
    });

    // A manager that is not installed, and one killed by a signal, both mean
    // the operation did not succeed — which is a resolved failure, never a
    // rejection, because the engine settles on the exit code.
    child.on('error', (error: Error) => {
      keepTail(error.message);
      settle(LAUNCH_FAILURE_EXIT_CODE);
    });
    child.on('close', (code) => settle(code ?? LAUNCH_FAILURE_EXIT_CODE));
  });
