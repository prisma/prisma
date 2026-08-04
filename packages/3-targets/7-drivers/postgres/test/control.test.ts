import type { Client } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { PostgresControlDriver } from '../src/exports/control';

describe('@internal/driver-postgres control', () => {
  it('absorbs client error events after create() instead of crashing the process', async () => {
    const listeners = new Map<string, (...args: unknown[]) => void>();
    const mockClient = {
      connect: vi.fn(async () => {}),
      end: vi.fn(async () => {}),
      on: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
        listeners.set(event, listener);
      }),
    };
    vi.doMock('pg', () => ({
      Client: vi.fn(function Client() {
        return mockClient;
      }),
    }));
    vi.resetModules();
    const { default: descriptor } = await import('../src/exports/control');

    const driver = await descriptor.create('postgres://localhost/test');

    expect(listeners.has('error')).toBe(true);
    expect(() =>
      listeners.get('error')?.(new Error('connection terminated unexpectedly')),
    ).not.toThrow();

    await driver.close();
    vi.doUnmock('pg');
  });

  it('close() resolves even when the underlying client.end() rejects', async () => {
    const mockClient = {
      end: vi.fn(async () => {
        throw new Error('connection already dropped');
      }),
    };
    const driver = new PostgresControlDriver(mockClient as unknown as Client);

    await expect(driver.close()).resolves.toBeUndefined();
  });
});
