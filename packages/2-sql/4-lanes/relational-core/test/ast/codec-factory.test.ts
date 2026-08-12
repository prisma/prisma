import { describe, expect, it } from 'vitest';
import { defineTestCodec } from './test-codec';

describe('defineTestCodec — query-time methods are Promise-returning', () => {
  it('lifts a sync encode into a Promise-returning method', async () => {
    const c = defineTestCodec({
      typeId: 'demo/sync-encode@1',
      encode: (value: string) => value.toUpperCase(),
      decode: (wire: string) => wire,
    });

    const encoded = c.encode!('hello', {});
    expect(encoded).toBeInstanceOf(Promise);
    expect(await encoded).toBe('HELLO');
  });

  it('lifts a sync decode into a Promise-returning method', async () => {
    const c = defineTestCodec({
      typeId: 'demo/sync-decode@1',
      encode: (value: string) => value,
      decode: (wire: string) => wire.toLowerCase(),
    });

    const decoded = c.decode('WORLD', {});
    expect(decoded).toBeInstanceOf(Promise);
    expect(await decoded).toBe('world');
  });

  it('accepts an async encode and produces a Promise-returning method', async () => {
    const c = defineTestCodec({
      typeId: 'demo/async-encode@1',
      encode: async (value: string) => value.toUpperCase(),
      decode: (wire: string) => wire,
    });

    const encoded = c.encode!('hello', {});
    expect(encoded).toBeInstanceOf(Promise);
    expect(await encoded).toBe('HELLO');
  });

  it('accepts an async decode and produces a Promise-returning method', async () => {
    const c = defineTestCodec({
      typeId: 'demo/async-decode@1',
      encode: (value: string) => value,
      decode: async (wire: string) => wire.toLowerCase(),
    });

    const decoded = c.decode('WORLD', {});
    expect(decoded).toBeInstanceOf(Promise);
    expect(await decoded).toBe('world');
  });

  it('accepts a mix of sync encode + async decode', async () => {
    const c = defineTestCodec({
      typeId: 'demo/mixed-a@1',
      encode: (value: string) => value,
      decode: async (wire: string) => wire.toUpperCase(),
    });

    expect(c.encode!('a', {})).toBeInstanceOf(Promise);
    expect(c.decode('a', {})).toBeInstanceOf(Promise);
    expect(await c.encode!('a', {})).toBe('a');
    expect(await c.decode('a', {})).toBe('A');
  });

  it('accepts a mix of async encode + sync decode', async () => {
    const c = defineTestCodec({
      typeId: 'demo/mixed-b@1',
      encode: async (value: string) => value.toUpperCase(),
      decode: (wire: string) => wire,
    });

    expect(c.encode!('a', {})).toBeInstanceOf(Promise);
    expect(c.decode('a', {})).toBeInstanceOf(Promise);
    expect(await c.encode!('a', {})).toBe('A');
    expect(await c.decode('a', {})).toBe('a');
  });

  it('passes encodeJson and decodeJson through as synchronous methods', () => {
    const c = defineTestCodec({
      typeId: 'demo/json-passthrough@1',
      encode: (value: string) => value,
      decode: (wire: string) => wire,
      encodeJson: (value: string) => value.toUpperCase(),
      decodeJson: (json) => `prefixed:${json as string}`,
    });

    const encodedJson = c.encodeJson('hello');
    const decodedJson = c.decodeJson('hello');
    expect(encodedJson).toBe('HELLO');
    expect(decodedJson).toBe('prefixed:hello');
    expect(encodedJson).not.toBeInstanceOf(Promise);
    expect(decodedJson).not.toBeInstanceOf(Promise);
  });

  // `renderOutputType` is a `CodecDescriptor`-side concern (TML-2357) — the legacy `defineTestCodec()` factory accepts the field for back-compat with existing call sites but the produced codec instance no longer carries it. The descriptor side is exercised by `sql-codecs.test.ts`.
});
