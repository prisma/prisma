import { describe, expect, it } from 'vitest';
import { geometry, geometryColumn } from '../src/exports/column-types';

describe('postgis column-types', () => {
  describe('geometryColumn (static)', () => {
    it('has correct codecId and nativeType', () => {
      expect(geometryColumn).toMatchObject({
        codecId: 'pg/geometry@1',
        nativeType: 'geometry',
      });
    });

    it('has no typeParams', () => {
      expect(geometryColumn).not.toHaveProperty('typeParams');
    });
  });

  describe('geometry() factory', () => {
    it('creates descriptor with typeParams.srid', () => {
      expect(geometry({ srid: 4326 })).toMatchObject({
        codecId: 'pg/geometry@1',
        nativeType: 'geometry',
        typeParams: { srid: 4326 },
      });
    });

    it('preserves the SRID type parameter', () => {
      expect(geometry({ srid: 3857 })).toMatchObject({
        typeParams: { srid: 3857 },
      });
    });

    it('rejects a non-integer SRID', () => {
      expect(() => geometry({ srid: 1.5 })).toThrow('srid must be a non-negative integer');
    });

    it('rejects a negative SRID', () => {
      expect(() => geometry({ srid: -1 })).toThrow('srid must be a non-negative integer');
    });
  });
});
