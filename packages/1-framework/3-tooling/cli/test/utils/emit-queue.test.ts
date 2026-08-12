import { afterEach, describe, expect, it } from 'vitest';
import { disposeEmitQueue, queueEmitByOutput } from '../../src/utils/emit-queue';

describe('emit queue', () => {
  // Use a unique path per test so module-global state from other tests cannot interfere.
  const uniquePath = (suffix = 'contract.json') =>
    `/tmp/emit-queue-${Math.random().toString(36).slice(2)}/${suffix}`;
  const disposed: string[] = [];

  afterEach(() => {
    for (const path of disposed) {
      disposeEmitQueue(path);
    }
    disposed.length = 0;
  });

  function track(path: string): string {
    disposed.push(path);
    return path;
  }

  it('serializes calls for the same output path', async () => {
    const path = track(uniquePath());
    const order: string[] = [];

    const first = queueEmitByOutput(path, async () => {
      order.push('first:start');
      await new Promise((resolve) => setTimeout(resolve, 20));
      order.push('first:end');
      return 1;
    });
    const second = queueEmitByOutput(path, async () => {
      order.push('second:start');
      return 2;
    });

    await Promise.all([first, second]);
    expect(order).toEqual(['first:start', 'first:end', 'second:start']);
  });

  it('runs subsequent actions even if a prior one rejects', async () => {
    const path = track(uniquePath());

    const first = queueEmitByOutput(path, async () => {
      throw new Error('first failed');
    });
    const second = queueEmitByOutput(path, async () => 'second-ran');

    await expect(first).rejects.toThrow('first failed');
    await expect(second).resolves.toBe('second-ran');
  });

  it('runs in parallel for distinct output paths', async () => {
    const pathA = track(uniquePath('a.json'));
    const pathB = track(uniquePath('b.json'));
    const order: string[] = [];

    const a = queueEmitByOutput(pathA, async () => {
      order.push('a:start');
      await new Promise((resolve) => setTimeout(resolve, 20));
      order.push('a:end');
    });
    const b = queueEmitByOutput(pathB, async () => {
      order.push('b:start');
      order.push('b:end');
    });

    await Promise.all([a, b]);
    // b ran fully while a was still pending — distinct paths must not block each other
    expect(order.indexOf('b:end')).toBeLessThan(order.indexOf('a:end'));
  });

  it('disposeEmitQueue is a no-op on unknown paths', () => {
    expect(() => disposeEmitQueue(uniquePath())).not.toThrow();
  });

  it('disposeEmitQueue removes the queue so a fresh one starts on the next submission', async () => {
    const path = track(uniquePath());

    await queueEmitByOutput(path, async () => 'ran');
    disposeEmitQueue(path);
    // After disposal a new submission still works (creates a fresh queue entry)
    await expect(queueEmitByOutput(path, async () => 'ran-again')).resolves.toBe('ran-again');
  });
});
