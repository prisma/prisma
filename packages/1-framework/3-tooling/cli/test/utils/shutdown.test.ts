import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createShutdownHandler } from '../../src/utils/shutdown';

describe('shutdown handler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('signal is not aborted initially', () => {
    const handler = createShutdownHandler({ exit: () => {} });
    expect(handler.signal.aborted).toBe(false);
    expect(handler.isShuttingDown()).toBe(false);
  });

  it('first signal aborts the signal and sets shuttingDown', () => {
    const handler = createShutdownHandler({ exit: () => {} });

    handler.onSignal();

    expect(handler.signal.aborted).toBe(true);
    expect(handler.isShuttingDown()).toBe(true);
    handler.clearGraceTimer();
  });

  it('abort listeners fire on first signal', () => {
    const handler = createShutdownHandler({ exit: () => {} });
    let aborted = false;
    handler.signal.addEventListener('abort', () => {
      aborted = true;
    });

    handler.onSignal();

    expect(aborted).toBe(true);
    handler.clearGraceTimer();
  });

  it('second signal calls exit(130) immediately', () => {
    const exit = vi.fn();
    const handler = createShutdownHandler({ exit });

    handler.onSignal(); // first — initiates shutdown
    expect(exit).not.toHaveBeenCalled();

    handler.onSignal(); // second — force exit
    expect(exit).toHaveBeenCalledWith(130);

    handler.clearGraceTimer();
  });

  it('grace timer calls exit(130) after timeout', () => {
    const exit = vi.fn();
    const handler = createShutdownHandler({ exit, gracePeriodMs: 3000 });

    handler.onSignal();
    expect(exit).not.toHaveBeenCalled();

    // Advance past the grace period
    vi.advanceTimersByTime(3000);

    expect(exit).toHaveBeenCalledWith(130);
  });

  it('grace timer does not fire before timeout', () => {
    const exit = vi.fn();
    const handler = createShutdownHandler({ exit, gracePeriodMs: 3000 });

    handler.onSignal();

    // Advance only partially
    vi.advanceTimersByTime(2999);
    expect(exit).not.toHaveBeenCalled();

    // Now cross the threshold
    vi.advanceTimersByTime(1);
    expect(exit).toHaveBeenCalledWith(130);
  });

  it('grace timer can be cleared before it fires', () => {
    const exit = vi.fn();
    const handler = createShutdownHandler({ exit, gracePeriodMs: 3000 });

    handler.onSignal();
    handler.clearGraceTimer();

    vi.advanceTimersByTime(5000);

    expect(exit).not.toHaveBeenCalled();
  });

  it('only fires abort event once even with multiple signals', () => {
    const exit = vi.fn();
    const handler = createShutdownHandler({ exit });
    let abortCount = 0;
    handler.signal.addEventListener('abort', () => {
      abortCount++;
    });

    handler.onSignal(); // first
    handler.onSignal(); // second (force exit, no second abort)

    expect(abortCount).toBe(1);
    handler.clearGraceTimer();
  });
});
