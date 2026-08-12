import { afterEach, describe, expect, it } from 'vitest';
import { detectScaffoldRuntime, shebangLineFor } from '../src/runtime-detection';

type GlobalWithRuntimes = typeof globalThis & {
  Bun?: unknown;
  Deno?: unknown;
};

describe('detectScaffoldRuntime', () => {
  afterEach(() => {
    const g = globalThis as GlobalWithRuntimes;
    delete g.Bun;
    delete g.Deno;
  });

  it('returns "bun" when globalThis.Bun is defined', () => {
    (globalThis as GlobalWithRuntimes).Bun = {};
    expect(detectScaffoldRuntime()).toBe('bun');
  });

  it('returns "deno" when globalThis.Deno is defined and Bun is not', () => {
    (globalThis as GlobalWithRuntimes).Deno = {};
    expect(detectScaffoldRuntime()).toBe('deno');
  });

  it('returns "node" when neither Bun nor Deno are defined', () => {
    expect(detectScaffoldRuntime()).toBe('node');
  });

  it('prefers "bun" over "deno" when both globals exist', () => {
    (globalThis as GlobalWithRuntimes).Bun = {};
    (globalThis as GlobalWithRuntimes).Deno = {};
    expect(detectScaffoldRuntime()).toBe('bun');
  });
});

describe('shebangLineFor', () => {
  it('emits the node shebang', () => {
    expect(shebangLineFor('node')).toBe('#!/usr/bin/env -S node');
  });

  it('emits the bun shebang', () => {
    expect(shebangLineFor('bun')).toBe('#!/usr/bin/env -S bun');
  });

  it('emits the deno shebang with run -A', () => {
    expect(shebangLineFor('deno')).toBe('#!/usr/bin/env -S deno run -A');
  });
});
