import { describe, expectTypeOf, test } from 'vitest';
import { type AnnotationValue, defineAnnotation } from '../src/annotations';
import { createMetaBuilder, type LaneMetaBuilder, type MetaBuilder } from '../src/meta-builder';

const readOnly = defineAnnotation<{ ttl: number }>()({
  namespace: 'cache',
  applicableTo: ['read'],
});

const writeOnly = defineAnnotation<{ actor: string }>()({
  namespace: 'audit',
  applicableTo: ['write'],
});

const both = defineAnnotation<{ traceId: string }>()({
  namespace: 'otel',
  applicableTo: ['read', 'write'],
});

describe('MetaBuilder<K> annotate', () => {
  test('read meta builder accepts read-only annotations', () => {
    const meta = createMetaBuilder('read', 'all');
    meta.annotate(readOnly({ ttl: 60 }));
  });

  test('read meta builder accepts both-kind annotations', () => {
    const meta = createMetaBuilder('read', 'all');
    meta.annotate(both({ traceId: 't' }));
  });

  test('read meta builder rejects write-only annotations (negative)', () => {
    const meta = createMetaBuilder('read', 'all');
    // @ts-expect-error - audit declares applicableTo: ['write'], not 'read'
    meta.annotate(writeOnly({ actor: 'system' }));
  });

  test('write meta builder accepts write-only annotations', () => {
    const meta = createMetaBuilder('write', 'create');
    meta.annotate(writeOnly({ actor: 'system' }));
  });

  test('write meta builder accepts both-kind annotations', () => {
    const meta = createMetaBuilder('write', 'create');
    meta.annotate(both({ traceId: 't' }));
  });

  test('write meta builder rejects read-only annotations (negative)', () => {
    const meta = createMetaBuilder('write', 'create');
    // @ts-expect-error - cache declares applicableTo: ['read'], not 'write'
    meta.annotate(readOnly({ ttl: 60 }));
  });

  test('annotate returns the builder for chaining', () => {
    const meta = createMetaBuilder('read', 'all');
    const result = meta.annotate(readOnly({ ttl: 60 }));
    expectTypeOf(result).toEqualTypeOf<typeof meta>();
  });

  test('chaining annotate calls preserves the lane meta builder type', () => {
    const meta = createMetaBuilder('read', 'all');
    const result = meta.annotate(readOnly({ ttl: 60 })).annotate(both({ traceId: 't' }));
    expectTypeOf(result).toEqualTypeOf<typeof meta>();
  });
});

describe('createMetaBuilder return type', () => {
  test('returns a LaneMetaBuilder<K> exposing the annotations map', () => {
    const meta = createMetaBuilder('read', 'all');
    expectTypeOf(meta).toEqualTypeOf<LaneMetaBuilder<'read'>>();
    expectTypeOf(meta.annotations).toEqualTypeOf<
      ReadonlyMap<string, AnnotationValue<unknown, 'read' | 'write'>>
    >();
  });

  test('LaneMetaBuilder<K> is assignable to MetaBuilder<K> (the user-callback view)', () => {
    const lane = createMetaBuilder('read', 'all');
    const view: MetaBuilder<'read'> = lane;
    void view;
  });

  test('MetaBuilder<K> does not expose the annotations map (negative)', () => {
    const view: MetaBuilder<'read'> = createMetaBuilder('read', 'all');
    // @ts-expect-error - annotations is not part of the public MetaBuilder<K> surface
    void view.annotations;
  });
});

describe('configurator-callback shape on lane terminals', () => {
  /**
   * Mimics the shape lane terminals adopt: an optional final
   * `configure: (meta: MetaBuilder<K>) => void` argument. The builder's
   * operation kind `K` is fixed by the terminal; `meta.annotate` accepts
   * any annotation whose declared kinds include `K`.
   */
  function readTerminal(configure?: (meta: MetaBuilder<'read'>) => void): void {
    const meta = createMetaBuilder('read', 'readTerminal');
    configure?.(meta);
  }

  function writeTerminal(configure?: (meta: MetaBuilder<'write'>) => void): void {
    const meta = createMetaBuilder('write', 'writeTerminal');
    configure?.(meta);
  }

  test('read terminal accepts a configurator with read-applicable annotations', () => {
    readTerminal((meta) => {
      meta.annotate(readOnly({ ttl: 60 }));
      meta.annotate(both({ traceId: 't' }));
    });
  });

  test('read terminal rejects a configurator that applies a write-only annotation (negative)', () => {
    readTerminal((meta) => {
      // @ts-expect-error - audit declares applicableTo: ['write'], not 'read'
      meta.annotate(writeOnly({ actor: 'system' }));
    });
  });

  test('write terminal accepts a configurator with write-applicable annotations', () => {
    writeTerminal((meta) => {
      meta.annotate(writeOnly({ actor: 'system' }));
      meta.annotate(both({ traceId: 't' }));
    });
  });

  test('write terminal rejects a configurator that applies a read-only annotation (negative)', () => {
    writeTerminal((meta) => {
      // @ts-expect-error - cache declares applicableTo: ['read'], not 'write'
      meta.annotate(readOnly({ ttl: 60 }));
    });
  });

  test('terminals accept omitted configurator (the parameter is optional)', () => {
    readTerminal();
    writeTerminal();
  });

  test('expression-body callback that returns the builder is accepted (return type ignored)', () => {
    readTerminal((meta) => meta.annotate(readOnly({ ttl: 60 })));
  });
});
