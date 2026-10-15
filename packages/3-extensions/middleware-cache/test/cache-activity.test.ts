import { describe, expect, it, vi } from 'vitest';
import { cacheAnnotation } from '../src/cache-annotation';
import { createCacheMiddleware } from '../src/cache-middleware';
import { endCall, makeCall, makeCtx, makeExec, runMiss, spyStore } from './middleware-fixtures';

const annotated = { cache: cacheAnnotation({}) };

describe('createCacheMiddleware — client activities such as ORM calls', () => {
  it('stores the result of an annotated call that succeeded, keyed by its content hash', async () => {
    const store = spyStore();
    const mw = createCacheMiddleware({ store });
    const call = makeCall(annotated);
    const ctx = makeCtx();

    const intercepted = await mw.intercept!.onActivity!(call, ctx);
    await endCall(mw, call, ctx, { result: [{ id: 1 }] });

    expect({ intercepted, stored: store.inner.get('call-hash') }).toEqual({
      intercepted: undefined,
      stored: { kind: 'result', result: [{ id: 1 }] },
    });
  });

  it('serves a stored result on the next call', async () => {
    const store = spyStore();
    store.inner.set('call-hash', { kind: 'result', result: { id: 1 } });
    const mw = createCacheMiddleware({ store });

    expect(await mw.intercept!.onActivity!(makeCall(annotated), makeCtx())).toEqual({
      result: { id: 1 },
    });
  });

  it('stores and serves null, which is a result', async () => {
    const store = spyStore();
    const mw = createCacheMiddleware({ store });
    const call = makeCall(annotated);
    const ctx = makeCtx();

    await mw.intercept!.onActivity!(call, ctx);
    await endCall(mw, call, ctx, { result: null });

    expect(await mw.intercept!.onActivity!(makeCall(annotated), makeCtx())).toEqual({
      result: null,
    });
  });

  it('keys on the annotation key, without computing the content hash', async () => {
    const store = spyStore();
    const mw = createCacheMiddleware({ store });
    const contentHash = vi.fn(async () => 'call-hash');
    const call = makeCall({ cache: cacheAnnotation({ key: 'user-1' }) }, contentHash);
    const ctx = makeCtx();

    await mw.intercept!.onActivity!(call, ctx);
    await endCall(mw, call, ctx, { result: { id: 1 } });

    expect({ hashed: contentHash.mock.calls.length, keys: [...store.inner.keys()] }).toEqual({
      hashed: 0,
      keys: ['user-1'],
    });
  });

  it.each([
    ['failed', { outcome: 'failed' as const }],
    ['stopped', { outcome: 'stopped' as const, result: [{ id: 1 }] }],
    ['succeeded without a result', {}],
  ])('stores nothing for a call that ended %s', async (_name, ended) => {
    const store = spyStore();
    const mw = createCacheMiddleware({ store });
    const call = makeCall(annotated);
    const ctx = makeCtx();

    await mw.intercept!.onActivity!(call, ctx);
    await endCall(mw, call, ctx, ended);

    expect(store.setSpy).not.toHaveBeenCalled();
  });

  it.each([
    ['inside a transaction', makeCtx({ inTransaction: () => true })],
    ['on a held connection', makeCtx({ scope: 'connection' })],
  ])('neither serves nor stores a call %s', async (_name, ctx) => {
    const store = spyStore();
    store.inner.set('call-hash', { kind: 'result', result: { id: 1 } });
    const mw = createCacheMiddleware({ store });
    const call = makeCall(annotated);

    const intercepted = await mw.intercept!.onActivity!(call, ctx);
    await endCall(mw, call, ctx, { result: { id: 2 } });

    expect({
      intercepted,
      gets: store.getSpy.mock.calls.length,
      sets: store.setSpy.mock.calls.length,
    }).toEqual({
      intercepted: undefined,
      gets: 0,
      sets: 0,
    });
  });

  it('ignores an unannotated or bypassed call', async () => {
    const store = spyStore();
    const mw = createCacheMiddleware({ store });

    await mw.intercept!.onActivity!(makeCall(), makeCtx());
    await mw.intercept!.onActivity!(
      makeCall({ cache: cacheAnnotation({ bypass: true }) }),
      makeCtx(),
    );

    expect(store.getSpy).not.toHaveBeenCalled();
  });
});

describe('createCacheMiddleware — statement rows and call results under one key', () => {
  it('does not serve statement rows to a call with the same key', async () => {
    const store = spyStore();
    store.setRows('shared', [{ id: 1 }]);
    const mw = createCacheMiddleware({ store });

    expect(
      await mw.intercept!.onActivity!(
        makeCall({ cache: cacheAnnotation({ key: 'shared' }) }),
        makeCtx(),
      ),
    ).toBeUndefined();
  });

  it('does not serve a call result to a statement with the same key', async () => {
    const store = spyStore();
    store.inner.set('shared', { kind: 'result', result: [{ id: 1 }] });
    const mw = createCacheMiddleware({ store });

    expect(
      await mw.intercept!.onQuery!(
        makeExec('select 1', { cache: cacheAnnotation({ key: 'shared' }) }),
        makeCtx(),
      ),
    ).toBeUndefined();
  });

  it('neither serves nor stores an annotated statement inside a transaction', async () => {
    const store = spyStore();
    store.setRows('key:select 1', [{ id: 1 }]);
    const mw = createCacheMiddleware({ store });
    const exec = makeExec('select 1', annotated);
    const ctx = makeCtx({ inTransaction: () => true });

    const intercepted = await mw.intercept!.onQuery!(exec, ctx);
    await runMiss(mw, makeExec('select 2', annotated), makeCtx({ inTransaction: () => true }), [
      { id: 2 },
    ]);

    expect({ intercepted, sets: store.setSpy.mock.calls.length }).toEqual({
      intercepted: undefined,
      sets: 0,
    });
  });
});
