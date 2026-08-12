/**
 * Per-output FIFO queue for `executeContractEmit`.
 *
 * Ensures that at most one emit (load → resolve source → emit bytes → publish)
 * runs per output JSON path at a time. Concurrent calls for the same path
 * line up behind the in-flight one and run in submission order; the user-visible
 * outcome is "last submission wins on disk" without any supersession bookkeeping.
 *
 * Long-lived hosts (Vite dev server, watch CLIs) must call `disposeEmitQueue`
 * when they stop publishing to a path, otherwise the module-global `Map`
 * accumulates one entry per unique output path for the lifetime of the process.
 */
const emitQueues = new Map<string, Promise<unknown>>();

export function queueEmitByOutput<T>(outputJsonPath: string, action: () => Promise<T>): Promise<T> {
  const previous = emitQueues.get(outputJsonPath) ?? Promise.resolve();
  // Continue regardless of the previous task's outcome — a failed emit must not
  // block subsequent ones. The current task's outcome propagates via `next`.
  const next = previous.then(action, action);
  emitQueues.set(outputJsonPath, next);
  return next;
}

export function disposeEmitQueue(outputJsonPath: string): void {
  emitQueues.delete(outputJsonPath);
}
