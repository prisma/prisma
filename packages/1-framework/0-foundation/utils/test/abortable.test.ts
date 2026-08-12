import { describe, expect, it } from 'vitest';
import { abortable } from '../src/abortable';

describe('abortable', () => {
  it('throws immediately if signal already aborted', () => {
    const controller = new AbortController();
    controller.abort(new Error('Already cancelled'));

    expect(() => abortable(controller.signal)).toThrow('Already cancelled');
  });

  it('resolves when promise completes before abort', async () => {
    const controller = new AbortController();
    const unlessAborted = abortable(controller.signal);

    const result = await unlessAborted(Promise.resolve('success'));

    expect(result).toBe('success');
  });

  it('rejects when signal is aborted before promise completes', async () => {
    const controller = new AbortController();
    const unlessAborted = abortable(controller.signal);

    const slowPromise = new Promise<string>((resolve) => {
      setTimeout(() => resolve('too late'), 100);
    });

    const resultPromise = unlessAborted(slowPromise);
    controller.abort();

    await expect(resultPromise).rejects.toThrow();
  });

  it('uses signal.reason when provided', async () => {
    const controller = new AbortController();
    const unlessAborted = abortable(controller.signal);

    const slowPromise = new Promise<string>((resolve) => {
      setTimeout(() => resolve('too late'), 100);
    });

    const resultPromise = unlessAborted(slowPromise);
    const customError = new Error('Custom abort reason');
    controller.abort(customError);

    await expect(resultPromise).rejects.toThrow('Custom abort reason');
  });

  it('uses signal default DOMException when no reason provided', async () => {
    const controller = new AbortController();
    const unlessAborted = abortable(controller.signal);

    const slowPromise = new Promise<string>((resolve) => {
      setTimeout(() => resolve('too late'), 100);
    });

    const resultPromise = unlessAborted(slowPromise);
    controller.abort();

    // Default abort reason is a DOMException with "This operation was aborted"
    await expect(resultPromise).rejects.toThrow('aborted');
  });

  it('can wrap multiple promises with same wrapper', async () => {
    const controller = new AbortController();
    const unlessAborted = abortable(controller.signal);

    const result1 = await unlessAborted(Promise.resolve(1));
    const result2 = await unlessAborted(Promise.resolve(2));
    const result3 = await unlessAborted(Promise.resolve(3));

    expect(result1).toBe(1);
    expect(result2).toBe(2);
    expect(result3).toBe(3);
  });
});
