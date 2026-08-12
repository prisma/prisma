/**
 * Global shutdown controller for graceful SIGINT/SIGTERM handling.
 *
 * The CLI installs signal handlers once at startup. When a signal fires:
 * 1. The AbortController is aborted — in-flight async work (DB queries, emit) can check `signal.aborted`.
 * 2. A 3-second grace timer starts — gives `finally` blocks time to close connections.
 * 3. If the process hasn't exited by then, force-exit with code 130 (128 + SIGINT).
 * 4. A second signal during the grace period force-exits immediately.
 */

/**
 * Creates a shutdown handler with its own AbortController.
 * Exposed for testing — production code uses the singleton below.
 */
export interface ShutdownHandler {
  readonly signal: AbortSignal;
  readonly isShuttingDown: () => boolean;
  readonly onSignal: () => void;
  readonly clearGraceTimer: () => void;
}

export function createShutdownHandler(options?: {
  readonly exit?: (code: number) => void;
  readonly gracePeriodMs?: number;
}): ShutdownHandler {
  const exit = options?.exit ?? ((code: number) => process.exit(code));
  const gracePeriodMs = options?.gracePeriodMs ?? 3000;

  const controller = new AbortController();
  let shuttingDown = false;
  let graceTimer: ReturnType<typeof setTimeout> | undefined;

  const onSignal = () => {
    if (shuttingDown) {
      // Second signal — force exit
      exit(130);
      return;
    }
    shuttingDown = true;
    controller.abort();

    // Give finally blocks time to clean up, then force-exit
    graceTimer = setTimeout(() => exit(130), gracePeriodMs);
    graceTimer.unref();
  };

  return {
    signal: controller.signal,
    isShuttingDown: () => shuttingDown,
    onSignal,
    clearGraceTimer: () => {
      if (graceTimer !== undefined) {
        clearTimeout(graceTimer);
        graceTimer = undefined;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Singleton for production use
// ---------------------------------------------------------------------------

const globalHandler = createShutdownHandler();

/**
 * The global AbortSignal. Pass this to any async operation that should
 * be cancellable on Ctrl+C (e.g., DB queries, long-running emit).
 */
export const shutdownSignal: AbortSignal = globalHandler.signal;

/**
 * Whether a shutdown has been initiated.
 */
export function isShuttingDown(): boolean {
  return globalHandler.isShuttingDown();
}

/**
 * Installs SIGINT and SIGTERM handlers. Call once at CLI startup.
 *
 * - First signal: aborts the controller, starts a 3s grace timer.
 * - Second signal: force-exits immediately.
 */
let installed = false;

export function installShutdownHandlers(): void {
  if (installed) return;
  installed = true;
  process.on('SIGINT', globalHandler.onSignal);
  process.on('SIGTERM', globalHandler.onSignal);
}
