import { describe, expect, it } from 'vitest';
import pgvectorPack from '../src/exports/pack';

describe('pgvector pack authoring contributions', () => {
  it('exposes a namespaced pgvector.Vector type constructor', () => {
    expect(pgvectorPack.authoring?.type).toMatchObject({
      pgvector: {
        Vector: {
          kind: 'typeConstructor',
          args: [{ kind: 'number', name: 'length', integer: true, minimum: 1 }],
          output: {
            codecId: 'pg/vector@1',
            nativeType: 'vector',
            typeParams: {
              length: {
                kind: 'arg',
                index: 0,
              },
            },
          },
        },
      },
    });
  });
});
