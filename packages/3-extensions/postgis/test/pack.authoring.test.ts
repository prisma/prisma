import { describe, expect, it } from 'vitest';
import postgisPack from '../src/exports/pack';

describe('postgis pack authoring contributions', () => {
  it('exposes a namespaced postgis.Geometry type constructor', () => {
    expect(postgisPack.authoring?.type).toMatchObject({
      postgis: {
        Geometry: {
          kind: 'typeConstructor',
          args: [{ kind: 'number', name: 'srid', integer: true, minimum: 0 }],
          output: {
            codecId: 'pg/geometry@1',
            nativeType: 'geometry',
            typeParams: { srid: { kind: 'arg', index: 0 } },
          },
        },
      },
    });
  });
});
