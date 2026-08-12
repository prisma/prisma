import type { SpinnerResult } from '@clack/prompts';
import type { ControlProgressEvent, OnControlProgress } from '../control-api/types';
import type { GlobalFlags } from './global-flags';
import type { TerminalUI } from './terminal-ui';

/**
 * Options for creating a progress adapter.
 */
interface ProgressAdapterOptions {
  readonly ui: TerminalUI;
  readonly flags: GlobalFlags;
}

/**
 * State for tracking active spans in the progress adapter.
 */
interface SpanState {
  readonly spinner: SpinnerResult;
  readonly startTime: number;
  readonly label: string;
}

/**
 * Creates a progress adapter that converts control-api progress events
 * into CLI spinner/progress output on stderr.
 *
 * The adapter:
 * - Starts/succeeds spinners for top-level span boundaries
 * - Prints per-operation lines for nested spans (e.g., migration operations under 'apply')
 * - Respects quiet/json/non-TTY flags (no-op in those cases)
 */
export function createProgressAdapter(options: ProgressAdapterOptions): OnControlProgress {
  const { ui, flags } = options;

  // Skip progress if quiet, JSON output, or non-interactive
  if (flags.quiet || flags.json || !ui.isInteractive) {
    return () => {};
  }

  // Track active spans by spanId
  const activeSpans = new Map<string, SpanState>();

  return (event: ControlProgressEvent) => {
    if (event.kind === 'spanStart') {
      // Nested spans (with parentSpanId) are printed as step lines
      if (event.parentSpanId) {
        ui.step(`${event.label}...`);
        return;
      }

      // Top-level spans get a spinner
      const spinner = ui.spinner();
      spinner.start(event.label);

      activeSpans.set(event.spanId, {
        spinner,
        startTime: Date.now(),
        label: event.label,
      });
    } else if (event.kind === 'spanEnd') {
      const spanState = activeSpans.get(event.spanId);
      if (spanState) {
        const elapsed = Date.now() - spanState.startTime;
        if (event.outcome === 'error') {
          spanState.spinner.error(`${spanState.label} (failed)`);
        } else if (event.outcome === 'skipped') {
          spanState.spinner.stop(`${spanState.label} (skipped)`);
        } else {
          spanState.spinner.stop(`${spanState.label} (${elapsed}ms)`);
        }
        activeSpans.delete(event.spanId);
      }
    }
  };
}
