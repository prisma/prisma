import { mongoCodec, newMongoCodecRegistry } from '@internal/mongo-codec';
import { MongoParamRef } from '@internal/mongo-value';
import { isStructuredError, structuredError } from '@internal/utils/structured-error';
import { describe, expect, it } from 'vitest';
import { resolveValue } from '../src/resolve-value';

interface RuntimeErrorShape extends Error {
  code?: string;
  details?: Record<string, unknown>;
  cause?: unknown;
}

const uppercaseCodec = mongoCodec({
  typeId: 'test/uppercase@1',
  decode: (wire: string) => wire.toLowerCase(),
  encode: (value: string) => value.toUpperCase(),
});

function testRegistry() {
  const registry = newMongoCodecRegistry();
  registry.register(uppercaseCodec);
  return registry;
}

function emptyRegistry() {
  return newMongoCodecRegistry();
}

const noCtx = {} as const;

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (v: T) => void;
} {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('resolveValue', () => {
  it('unwraps MongoParamRef without codec registry', async () => {
    const ref = new MongoParamRef('hello');
    expect(await resolveValue(ref, emptyRegistry(), noCtx)).toBe('hello');
  });

  it('unwraps MongoParamRef without codecId even when registry is provided', async () => {
    const ref = new MongoParamRef('hello');
    expect(await resolveValue(ref, testRegistry(), noCtx)).toBe('hello');
  });

  it('applies codec encode when MongoParamRef has codecId and registry has codec', async () => {
    const ref = new MongoParamRef('hello', { codecId: 'test/uppercase@1' });
    expect(await resolveValue(ref, testRegistry(), noCtx)).toBe('HELLO');
  });

  it('falls back to raw value when codecId is set but registry is empty', async () => {
    const ref = new MongoParamRef('hello', { codecId: 'test/uppercase@1' });
    expect(await resolveValue(ref, emptyRegistry(), noCtx)).toBe('hello');
  });

  it('falls back to raw value when codecId is not in registry', async () => {
    const ref = new MongoParamRef('hello', { codecId: 'test/unknown@1' });
    expect(await resolveValue(ref, testRegistry(), noCtx)).toBe('hello');
  });

  it('encodes nested MongoParamRef with codecId inside object', async () => {
    const doc = {
      name: new MongoParamRef('alice'),
      label: new MongoParamRef('greeting', { codecId: 'test/uppercase@1' }),
    };
    const result = (await resolveValue(doc, testRegistry(), noCtx)) as Record<string, unknown>;
    expect(result['name']).toBe('alice');
    expect(result['label']).toBe('GREETING');
  });

  it('encodes MongoParamRef with codecId inside array', async () => {
    const arr = [new MongoParamRef('a', { codecId: 'test/uppercase@1' }), new MongoParamRef('b')];
    const result = (await resolveValue(arr, testRegistry(), noCtx)) as unknown[];
    expect(result[0]).toBe('A');
    expect(result[1]).toBe('b');
  });

  it('preserves null, primitive, and Date values', async () => {
    expect(await resolveValue(null, emptyRegistry(), noCtx)).toBeNull();
    expect(await resolveValue(42, emptyRegistry(), noCtx)).toBe(42);
    expect(await resolveValue('raw', emptyRegistry(), noCtx)).toBe('raw');
    const d = new Date();
    expect(await resolveValue(d, emptyRegistry(), noCtx)).toBe(d);
  });

  describe('async dispatch — codec encode + concurrent encoding', () => {
    it('returns a Promise', () => {
      const result = resolveValue(new MongoParamRef('x'), emptyRegistry(), noCtx);
      expect(typeof (result as { then?: unknown }).then).toBe('function');
    });

    it('dispatches multiple codec-encoded leaves concurrently via Promise.all', async () => {
      const dA = deferred<string>();
      const dB = deferred<string>();
      const callOrder: string[] = [];

      const asyncACodec = mongoCodec({
        typeId: 'test/async-a@1',
        decode: (wire: string) => wire,
        encode: (value: string) => {
          callOrder.push('encode-a-start');
          return dA.promise.then((suffix) => `${value}:${suffix}`);
        },
      });
      const asyncBCodec = mongoCodec({
        typeId: 'test/async-b@1',
        decode: (wire: string) => wire,
        encode: (value: string) => {
          callOrder.push('encode-b-start');
          return dB.promise.then((suffix) => `${value}:${suffix}`);
        },
      });

      const registry = newMongoCodecRegistry();
      registry.register(asyncACodec);
      registry.register(asyncBCodec);

      const doc = {
        a: new MongoParamRef('alpha', { codecId: 'test/async-a@1' }),
        b: new MongoParamRef('beta', { codecId: 'test/async-b@1' }),
      };

      const resultPromise = resolveValue(doc, registry, noCtx);

      // Both encode functions must have started before either resolves — i.e. dispatch is concurrent, not sequential.
      await new Promise((r) => setImmediate(r));
      expect(callOrder).toEqual(['encode-a-start', 'encode-b-start']);

      dB.resolve('B-WIRE');
      dA.resolve('A-WIRE');

      const result = (await resultPromise) as Record<string, unknown>;
      expect(result['a']).toBe('alpha:A-WIRE');
      expect(result['b']).toBe('beta:B-WIRE');
    });

    it('dispatches concurrently across array elements via Promise.all', async () => {
      const d1 = deferred<string>();
      const d2 = deferred<string>();
      const callOrder: string[] = [];

      const codec = mongoCodec({
        typeId: 'test/seq@1',
        decode: (w: string) => w,
        encode: async (value: string) => {
          callOrder.push(`start:${value}`);
          if (value === 'one') return d1.promise;
          return d2.promise;
        },
      });

      const registry = newMongoCodecRegistry();
      registry.register(codec);

      const arr = [
        new MongoParamRef('one', { codecId: 'test/seq@1' }),
        new MongoParamRef('two', { codecId: 'test/seq@1' }),
      ];

      const resultPromise = resolveValue(arr, registry, noCtx);

      await new Promise((r) => setImmediate(r));
      expect(callOrder).toEqual(['start:one', 'start:two']);

      d1.resolve('1');
      d2.resolve('2');

      const result = (await resultPromise) as unknown[];
      expect(result).toEqual(['1', '2']);
    });

    it('passes through non-MongoParamRef values unchanged (identity passthrough)', async () => {
      // A plain value with no MongoParamRef inside should round-trip identical structure.
      const input = { x: 1, y: [2, 3], z: { nested: 'leaf' } };
      const result = await resolveValue(input, emptyRegistry(), noCtx);
      expect(result).toEqual(input);
    });
  });

  describe('error envelope (RUNTIME.ENCODE_FAILED)', () => {
    it('wraps codec.encode failures in RUNTIME.ENCODE_FAILED with cause and codec id', async () => {
      const failingCodec = mongoCodec({
        typeId: 'test/failing@1',
        decode: (w: string) => w,
        encode: async (_v: string) => {
          throw new Error('kms-key-resolution-failed');
        },
      });
      const registry = newMongoCodecRegistry();
      registry.register(failingCodec);

      const ref = new MongoParamRef('plaintext', { codecId: 'test/failing@1' });
      const rejection = (await resolveValue(ref, registry, noCtx).catch(
        (e: unknown) => e,
      )) as Error;
      expect(rejection).toBeInstanceOf(Error);
      const err = rejection as RuntimeErrorShape;
      expect(err.code).toBe('RUNTIME.ENCODE_FAILED');
      expect(err.message).toContain('test/failing@1');
      expect(err.message).toContain('kms-key-resolution-failed');
      expect(err.details?.['codec']).toBe('test/failing@1');
      expect((err.cause as Error | undefined)?.message).toBe('kms-key-resolution-failed');
    });

    it('uses MongoParamRef.name as the envelope label when available', async () => {
      const failingCodec = mongoCodec({
        typeId: 'test/failing@1',
        decode: (w: string) => w,
        encode: async (_v: string) => {
          throw new Error('boom');
        },
      });
      const registry = newMongoCodecRegistry();
      registry.register(failingCodec);

      const ref = new MongoParamRef('plaintext', {
        codecId: 'test/failing@1',
        name: 'user.email',
      });
      const rejection = (await resolveValue(ref, registry, noCtx).catch(
        (e: unknown) => e,
      )) as Error;
      const err = rejection as RuntimeErrorShape;
      expect(err.details?.['label']).toBe('user.email');
      expect(err.message).toContain('user.email');
    });

    it('falls back to codec id as the envelope label when MongoParamRef has no name', async () => {
      const failingCodec = mongoCodec({
        typeId: 'test/failing@1',
        decode: (w: string) => w,
        encode: async (_v: string) => {
          throw new Error('boom');
        },
      });
      const registry = newMongoCodecRegistry();
      registry.register(failingCodec);

      const ref = new MongoParamRef('plaintext', { codecId: 'test/failing@1' });
      const rejection = (await resolveValue(ref, registry, noCtx).catch(
        (e: unknown) => e,
      )) as Error;
      const err = rejection as RuntimeErrorShape;
      expect(err.details?.['label']).toBe('test/failing@1');
    });

    it('preserves an existing RUNTIME.ENCODE_FAILED envelope without re-wrapping', async () => {
      const innerCodec = mongoCodec({
        typeId: 'test/already-wrapped@1',
        decode: (w: string) => w,
        encode: async (_v: string) => {
          const err = new Error('original') as RuntimeErrorShape;
          err.code = 'RUNTIME.ENCODE_FAILED';
          throw err;
        },
      });
      const registry = newMongoCodecRegistry();
      registry.register(innerCodec);

      const ref = new MongoParamRef('x', { codecId: 'test/already-wrapped@1' });
      const rejection = (await resolveValue(ref, registry, noCtx).catch(
        (e: unknown) => e,
      )) as Error;
      const err = rejection as RuntimeErrorShape;
      expect(err.code).toBe('RUNTIME.ENCODE_FAILED');
      expect(err.message).toBe('original');
    });

    it('passes any structured envelope through unchanged instead of re-wrapping', async () => {
      const envelope = structuredError('EXT.CODEC_BROKEN', 'codec-owned envelope');
      const innerCodec = mongoCodec({
        typeId: 'test/structured@1',
        decode: (w: string) => w,
        encode: async (_v: string) => {
          throw envelope;
        },
      });
      const registry = newMongoCodecRegistry();
      registry.register(innerCodec);

      const ref = new MongoParamRef('x', { codecId: 'test/structured@1' });
      const rejection = await resolveValue(ref, registry, noCtx).catch((e: unknown) => e);
      expect(rejection).toBe(envelope);
      expect(isStructuredError(rejection)).toBe(true);
    });

    it('wraps a plain codec failure in RUNTIME.ENCODE_FAILED', async () => {
      const innerCodec = mongoCodec({
        typeId: 'test/plain-failure@1',
        decode: (w: string) => w,
        encode: async (_v: string) => {
          throw new Error('plain failure');
        },
      });
      const registry = newMongoCodecRegistry();
      registry.register(innerCodec);

      const ref = new MongoParamRef('x', { codecId: 'test/plain-failure@1' });
      const rejection = await resolveValue(ref, registry, noCtx).catch((e: unknown) => e);
      expect(isStructuredError(rejection)).toBe(true);
      const err = rejection as RuntimeErrorShape;
      expect(err.code).toBe('RUNTIME.ENCODE_FAILED');
      expect((err.cause as Error).message).toBe('plain failure');
    });
  });
});
