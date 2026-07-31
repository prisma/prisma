/**
 * FIFO queue with amortised O(1) push and shift.
 *
 * Uses a head-index cursor over a backing array rather than
 * `Array.prototype.shift()`, which is O(n) on V8. Intended for BFS-shaped
 * traversals where the queue is drained in a single pass — it does not
 * reclaim memory for already-shifted items, so it is not suitable for
 * long-lived queues with many push/shift cycles.
 */
import { InternalError } from '@internal/utils/internal-error';

export class Queue<T> {
  private readonly items: T[];
  private head = 0;

  constructor(initial: Iterable<T> = []) {
    this.items = [...initial];
  }

  push(item: T): void {
    this.items.push(item);
  }

  /**
   * Remove and return the next item. Caller must check `isEmpty` first —
   * shifting an empty queue throws.
   */
  shift(): T {
    if (this.head >= this.items.length) {
      throw new InternalError('Queue.shift called on empty queue');
    }
    // biome-ignore lint/style/noNonNullAssertion: bounds-checked on the line above
    return this.items[this.head++]!;
  }

  get isEmpty(): boolean {
    return this.head >= this.items.length;
  }
}
