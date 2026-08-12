import type { Command } from 'commander';
import { vi } from 'vitest';

// Module-level variable to track exit code (more reliable than vi.fn().mock.calls when mock throws)
let lastExitCode: number | undefined;

/**
 * Gets the exit code from the process.exit mock.
 * Returns undefined if process.exit hasn't been called yet.
 * Note: process.exit() without argument defaults to 0, but we return undefined to distinguish "not called" from "called with 0".
 * If you need to check for success (exit code 0), check if executeCommand didn't throw instead.
 */
export function getExitCode(): number | undefined {
  return lastExitCode;
}

/**
 * Resets the exit code tracking. Called automatically by setupCommandMocks().
 */
export function resetExitCode(): void {
  lastExitCode = undefined;
}

/**
 * Executes a command and catches process.exit errors (which are expected in tests).
 * Returns the exit code that was passed to process.exit(), or 0 if process.exit() wasn't called.
 * For real errors (not process.exit), returns 1 to indicate failure.
 * This handles cases where validation errors are thrown before process.exit() is called.
 */
export async function executeCommand(command: Command, args: string[]): Promise<number> {
  try {
    // Use { from: 'user' } to tell Commander these are user args, not process.argv format
    // process.argv format would be ['node', 'script.js', '--option', 'value']
    // User args format is just ['--option', 'value']
    await command.parseAsync(args, { from: 'user' });
    // Command completed successfully without calling process.exit()
    return 0;
  } catch (error) {
    // process.exit throws an error in tests - extract the exit code
    if (error instanceof Error && error.message === 'process.exit called') {
      const exitCode = getExitCode() ?? 0; // Default to 0 if not set
      // For success (exit code 0), swallow the error
      // For errors (non-zero), re-throw so tests can check console errors
      if (exitCode !== 0) {
        throw error;
      }
      // Exit code 0 - success, don't throw
      return 0;
    }
    // Real error (not process.exit), re-throw
    throw error;
  }
}

/**
 * Sets up console and process.exit mocks for CLI command tests.
 *
 * Simulates an interactive terminal (`process.stdout.isTTY = true`) so that
 * TerminalUI enables decoration (headers, spinners, human-readable output).
 *
 * Captures output from:
 * - `process.stdout.write` → `consoleOutput` (JSON data via `ui.output()`)
 * - `process.stderr.write` → `consoleErrors` AND `consoleOutput` (decoration via `ui.log()`, `ui.error()`, etc.)
 *
 * Merging stderr into consoleOutput maintains backward compatibility with tests
 * that check `consoleOutput` for human-readable text. Tests that need only errors
 * can check `consoleErrors`. Tests that need only JSON should use `--json` flag
 * (JSON goes to stdout, decoration goes to stderr — they don't mix).
 */
export function setupCommandMocks(options?: { isTTY?: boolean | undefined }): {
  consoleOutput: string[];
  consoleErrors: string[];
  cleanup: () => void;
} {
  const consoleOutput: string[] = [];
  const consoleErrors: string[] = [];

  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  const originalExit = process.exit;
  const originalStdoutWrite = process.stdout.write;
  const originalStderrWrite = process.stderr.write;
  const originalIsTTY = process.stdout.isTTY;

  // Reset exit code tracking
  resetExitCode();

  // Default to interactive (TTY) mode; pass { isTTY: false } to simulate piped stdout
  process.stdout.isTTY = options?.isTTY ?? true;

  // Mock console.log (legacy path)
  console.log = vi.fn((...args: unknown[]) => {
    consoleOutput.push(args.map(String).join(' '));
  }) as typeof console.log;

  // Mock console.error (legacy path)
  console.error = vi.fn((...args: unknown[]) => {
    consoleErrors.push(args.map(String).join(' '));
  }) as typeof console.error;

  // Mock process.stdout.write (ui.output writes JSON data here)
  process.stdout.write = vi.fn((chunk: unknown) => {
    const text = typeof chunk === 'string' ? chunk : String(chunk);
    const trimmed = text.endsWith('\n') ? text.slice(0, -1) : text;
    if (trimmed) {
      consoleOutput.push(trimmed);
    }
    return true;
  }) as typeof process.stdout.write;

  // Mock process.stderr.write (TerminalUI decoration + @clack/prompts write here)
  // Route to BOTH consoleErrors and consoleOutput for backward compatibility
  process.stderr.write = vi.fn((chunk: unknown) => {
    const text = typeof chunk === 'string' ? chunk : String(chunk);
    const trimmed = text.endsWith('\n') ? text.slice(0, -1) : text;
    if (trimmed) {
      consoleErrors.push(trimmed);
      consoleOutput.push(trimmed);
    }
    return true;
  }) as typeof process.stderr.write;

  // Mock process.exit to record the exit code and throw
  process.exit = vi.fn((code?: number) => {
    lastExitCode = code ?? 0;
    throw new Error('process.exit called');
  }) as unknown as typeof process.exit;

  const cleanup = () => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    process.exit = originalExit;
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
    process.stdout.isTTY = originalIsTTY;
    resetExitCode();
  };

  return { consoleOutput, consoleErrors, cleanup };
}

export function parseJsonObjectFromCliCapture(lines: readonly string[]): unknown {
  const joined = lines.join('\n');
  const start = joined.indexOf('{');
  const end = joined.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new SyntaxError(
      `No JSON object in CLI capture (first 800 chars):\n${joined.slice(0, 800)}`,
    );
  }
  return JSON.parse(joined.slice(start, end + 1));
}
