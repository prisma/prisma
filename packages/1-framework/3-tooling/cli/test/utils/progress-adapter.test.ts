import { timeouts } from '@repo/test-utils';
import { describe, expect, it, vi } from 'vitest';
import type { ControlProgressEvent } from '../../src/control-api/types';
import type { GlobalFlags } from '../../src/utils/global-flags';
import { createProgressAdapter } from '../../src/utils/progress-adapter';
import { createTerminalUI } from '../../src/utils/terminal-ui';

function defaultTestFlags(overrides: Partial<GlobalFlags> = {}): GlobalFlags {
  return {
    format: 'pretty',
    explicitFormat: false,
    quiet: false,
    verbose: 0,
    color: false,
    interactive: true,
    ...overrides,
  };
}

function createAdapter(flags: Partial<GlobalFlags> = {}) {
  const resolved = defaultTestFlags(flags);
  const ui = createTerminalUI(resolved);
  return createProgressAdapter({ ui, flags: resolved });
}

describe('progress adapter', () => {
  it('is no-op when quiet flag is set', () => {
    const adapter = createAdapter({ quiet: true });
    const event: ControlProgressEvent = {
      action: 'dbInit',
      kind: 'spanStart',
      spanId: 'test',
      label: 'Test',
    };

    // Should not throw
    adapter(event);
  });

  it('is no-op when json output is enabled', () => {
    const adapter = createAdapter({ json: true });
    const event: ControlProgressEvent = {
      action: 'dbInit',
      kind: 'spanStart',
      spanId: 'test',
      label: 'Test',
    };

    // Should not throw
    adapter(event);
  });

  it('is no-op when stdout is not a TTY', () => {
    const originalIsTTY = process.stdout.isTTY;
    process.stdout.isTTY = false;

    try {
      const adapter = createAdapter();
      const event: ControlProgressEvent = {
        action: 'dbInit',
        kind: 'spanStart',
        spanId: 'test',
        label: 'Test',
      };

      // Should not throw
      adapter(event);
    } finally {
      process.stdout.isTTY = originalIsTTY;
    }
  });

  it('handles spanStart and spanEnd events', { timeout: timeouts.default }, () => {
    // Mock process.stdout.isTTY
    const originalIsTTY = process.stdout.isTTY;
    process.stdout.isTTY = true;

    try {
      const adapter = createAdapter();
      const events: ControlProgressEvent[] = [
        {
          action: 'dbInit',
          kind: 'spanStart',
          spanId: 'test',
          label: 'Test operation',
        },
        {
          action: 'dbInit',
          kind: 'spanEnd',
          spanId: 'test',
          outcome: 'ok',
        },
      ];

      // Should not throw
      for (const event of events) {
        adapter(event);
      }
    } finally {
      process.stdout.isTTY = originalIsTTY;
    }
  });

  it('handles spanEnd with error outcome', () => {
    const originalIsTTY = process.stdout.isTTY;
    process.stdout.isTTY = true;

    try {
      const adapter = createAdapter();

      // Start span
      adapter({
        action: 'dbInit',
        kind: 'spanStart',
        spanId: 'test-error',
        label: 'Test error operation',
      });

      // End span with error outcome
      adapter({
        action: 'dbInit',
        kind: 'spanEnd',
        spanId: 'test-error',
        outcome: 'error',
      });
    } finally {
      process.stdout.isTTY = originalIsTTY;
    }
  });

  it('handles spanEnd with skipped outcome', () => {
    const originalIsTTY = process.stdout.isTTY;
    process.stdout.isTTY = true;

    try {
      const adapter = createAdapter();

      // Start span
      adapter({
        action: 'dbInit',
        kind: 'spanStart',
        spanId: 'test-skipped',
        label: 'Test skipped operation',
      });

      // End span with skipped outcome
      adapter({
        action: 'dbInit',
        kind: 'spanEnd',
        spanId: 'test-skipped',
        outcome: 'skipped',
      });
    } finally {
      process.stdout.isTTY = originalIsTTY;
    }
  });

  it('handles spanEnd for unknown spanId gracefully', () => {
    const originalIsTTY = process.stdout.isTTY;
    process.stdout.isTTY = true;

    try {
      const adapter = createAdapter();

      // End span without starting it - should be no-op
      adapter({
        action: 'dbInit',
        kind: 'spanEnd',
        spanId: 'unknown-span',
        outcome: 'ok',
      });
    } finally {
      process.stdout.isTTY = originalIsTTY;
    }
  });

  it('handles color flag set to false', () => {
    const originalIsTTY = process.stdout.isTTY;
    process.stdout.isTTY = true;

    try {
      const adapter = createAdapter({ color: false });

      // Start span with color disabled
      adapter({
        action: 'dbInit',
        kind: 'spanStart',
        spanId: 'no-color-span',
        label: 'No color operation',
      });

      // End span
      adapter({
        action: 'dbInit',
        kind: 'spanEnd',
        spanId: 'no-color-span',
        outcome: 'ok',
      });
    } finally {
      process.stdout.isTTY = originalIsTTY;
    }
  });

  it('prints nested spans to stderr instead of spinners', () => {
    // Mock process.stdout.isTTY for interactive mode
    const originalIsTTY = process.stdout.isTTY;
    process.stdout.isTTY = true;

    // Mock process.stderr.write (clack writes to stderr)
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    try {
      const adapter = createAdapter();
      const event: ControlProgressEvent = {
        action: 'dbInit',
        kind: 'spanStart',
        spanId: 'operation:op-1',
        parentSpanId: 'apply',
        label: 'Create table users',
      };

      adapter(event);

      // Nested spans write to stderr via clack.log.step
      expect(stderrSpy).toHaveBeenCalled();
      const output = stderrSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('');
      expect(output).toContain('Create table users');
    } finally {
      stderrSpy.mockRestore();
      process.stdout.isTTY = originalIsTTY;
    }
  });
});
