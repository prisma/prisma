import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  resolveTelemetryBackendConfig,
  shutdownExitCode,
  stopTelemetryBackend,
} from '../src/server-runtime';

describe('resolveTelemetryBackendConfig', () => {
  it('honours PORT and RATE_LIMIT_RPM from the passed-in env (not process.env)', () => {
    const config = resolveTelemetryBackendConfig({
      DATABASE_URL: 'postgres://test/test',
      PORT: '4321',
      RATE_LIMIT_RPM: '7',
    });
    expect(config.port).toBe(4321);
    expect(config.requestsPerMinute).toBe(7);
  });

  it('falls back to defaults when PORT and RATE_LIMIT_RPM are absent from the passed-in env', () => {
    const config = resolveTelemetryBackendConfig({ DATABASE_URL: 'postgres://test/test' });
    expect(config.port).toBe(8080);
    expect(config.requestsPerMinute).toBe(120);
  });
});

describe('shutdownExitCode', () => {
  it('returns 0 for a clean stopped result', () => {
    expect(shutdownExitCode('stopped')).toBe(0);
  });

  it('returns 1 for a timed-out result so supervisors notice failed shutdowns', () => {
    expect(shutdownExitCode('timed-out')).toBe(1);
  });
});

describe('telemetry backend shutdown', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('times out the whole shutdown when server stop does not settle', async () => {
    vi.useFakeTimers();
    const close = vi.fn<() => Promise<void>>(async () => undefined);

    const resultPromise = stopTelemetryBackend(
      {
        port: 8080,
        stop: () => new Promise<void>(() => undefined),
      },
      { close },
    );

    await vi.advanceTimersByTimeAsync(10_000);

    await expect(resultPromise).resolves.toBe('timed-out');
    expect(close).not.toHaveBeenCalled();
  });

  it('times out the whole shutdown when app close does not settle', async () => {
    vi.useFakeTimers();
    const stop = vi.fn<() => Promise<void>>(async () => undefined);

    const resultPromise = stopTelemetryBackend(
      { port: 8080, stop },
      { close: () => new Promise<void>(() => undefined) },
    );

    await vi.advanceTimersByTimeAsync(10_000);

    await expect(resultPromise).resolves.toBe('timed-out');
    expect(stop).toHaveBeenCalledOnce();
  });
});
