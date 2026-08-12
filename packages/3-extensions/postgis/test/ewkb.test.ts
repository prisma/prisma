import { describe, expect, it } from 'vitest';
import { decodeEWKBHex, encodeEWKBHex, encodeEWKT } from '../src/core/ewkb';
import type { Geometry } from '../src/core/geojson';

describe('postgis EWKB / EWKT', () => {
  it.each([
    { type: 'Point', coordinates: [1, 2], srid: 4326 },
    {
      type: 'LineString',
      coordinates: [
        [0, 0],
        [1, 1],
      ],
    },
    {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [0, 0],
        ],
      ],
    },
    {
      type: 'MultiPoint',
      coordinates: [
        [0, 0],
        [1, 1],
      ],
      srid: 4326,
    },
    {
      type: 'MultiLineString',
      coordinates: [
        [
          [0, 0],
          [1, 1],
        ],
      ],
    },
    {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [0, 0],
            [1, 0],
            [0, 0],
          ],
        ],
      ],
    },
  ] satisfies Geometry[])('round-trips $type through HEXEWKB', (geometry) => {
    expect(decodeEWKBHex(encodeEWKBHex(geometry))).toEqual(geometry);
  });

  describe('encodeEWKT', () => {
    it('Point without SRID', () => {
      expect(encodeEWKT({ type: 'Point', coordinates: [1, 2] })).toBe('POINT(1 2)');
    });

    it('Point with SRID', () => {
      expect(encodeEWKT({ type: 'Point', coordinates: [1, 2], srid: 4326 })).toBe(
        'SRID=4326;POINT(1 2)',
      );
    });

    it('LineString', () => {
      expect(
        encodeEWKT({
          type: 'LineString',
          coordinates: [
            [0, 0],
            [1, 1],
          ],
        }),
      ).toBe('LINESTRING(0 0,1 1)');
    });

    it('Polygon with multiple rings', () => {
      expect(
        encodeEWKT({
          type: 'Polygon',
          coordinates: [
            [
              [0, 0],
              [10, 0],
              [10, 10],
              [0, 10],
              [0, 0],
            ],
            [
              [2, 2],
              [4, 2],
              [4, 4],
              [2, 4],
              [2, 2],
            ],
          ],
        }),
      ).toBe('POLYGON((0 0,10 0,10 10,0 10,0 0),(2 2,4 2,4 4,2 4,2 2))');
    });

    it('MultiLineString', () => {
      expect(
        encodeEWKT({
          type: 'MultiLineString',
          coordinates: [
            [
              [0, 0],
              [1, 0],
            ],
            [
              [2, 2],
              [3, 3],
            ],
          ],
        }),
      ).toBe('MULTILINESTRING((0 0,1 0),(2 2,3 3))');
    });

    it('MultiPolygon', () => {
      expect(
        encodeEWKT({
          type: 'MultiPolygon',
          coordinates: [
            [
              [
                [0, 0],
                [1, 0],
                [1, 1],
                [0, 0],
              ],
            ],
          ],
        }),
      ).toBe('MULTIPOLYGON(((0 0,1 0,1 1,0 0)))');
    });

    it('rejects non-finite coordinates', () => {
      expect(() =>
        encodeEWKT({ type: 'Point', coordinates: [Number.POSITIVE_INFINITY, 0] }),
      ).toThrow('coordinates must be finite numbers');
    });
  });

  describe('decodeEWKBHex', () => {
    it('decodes a Point with SRID 4326', () => {
      // 01 byte-order LE
      // 01000020 type Point|SRID
      // E6100000 srid 4326
      // 000000000000F03F x=1.0
      // 0000000000000040 y=2.0
      expect(decodeEWKBHex('0101000020E6100000000000000000F03F0000000000000040')).toEqual({
        type: 'Point',
        coordinates: [1, 2],
        srid: 4326,
      });
    });

    it('decodes a LineString without SRID', () => {
      // 01 LE
      // 02000000 type LineString
      // 02000000 numPoints=2
      // x=0, y=0
      // x=1, y=1
      const hex =
        '01' +
        '02000000' +
        '02000000' +
        '0000000000000000' +
        '0000000000000000' +
        '000000000000F03F' +
        '000000000000F03F';
      expect(decodeEWKBHex(hex)).toEqual({
        type: 'LineString',
        coordinates: [
          [0, 0],
          [1, 1],
        ],
      });
    });

    it('decodes a Polygon with a single ring (LE)', () => {
      // LE Polygon: ring [(0,0),(1,0),(1,1),(0,0)]
      const hex =
        '01' +
        '03000000' + // type Polygon
        '01000000' + // numRings = 1
        '04000000' + // numPoints = 4
        '0000000000000000' +
        '0000000000000000' +
        '000000000000F03F' +
        '0000000000000000' +
        '000000000000F03F' +
        '000000000000F03F' +
        '0000000000000000' +
        '0000000000000000';
      expect(decodeEWKBHex(hex)).toEqual({
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
          ],
        ],
      });
    });

    it('decodes big-endian point', () => {
      // BE byte-order, type Point (00000001), x=1.0, y=2.0
      const hex = '00' + '00000001' + '3FF0000000000000' + '4000000000000000';
      expect(decodeEWKBHex(hex)).toEqual({ type: 'Point', coordinates: [1, 2] });
    });

    it('decodes a MultiPoint with SRID', () => {
      // Outer: LE MultiPoint with SRID, then 2 sub-Points (each LE Point without
      // its own SRID — sub-records inherit the parent SRID in EWKB).
      const hex =
        '01' +
        '04000020' + // MultiPoint | SRID
        'E6100000' + // 4326
        '02000000' + // 2 points
        '01' +
        '01000000' + // sub Point LE
        '0000000000000000' +
        '0000000000000000' +
        '01' +
        '01000000' + // sub Point LE
        '000000000000F03F' +
        '000000000000F03F';
      expect(decodeEWKBHex(hex)).toEqual({
        type: 'MultiPoint',
        coordinates: [
          [0, 0],
          [1, 1],
        ],
        srid: 4326,
      });
    });

    it('throws on Z/M coordinates', () => {
      // LE Point with Z flag (0x80000000) set
      const hex = '01' + '01000080' + '0000000000000000' + '0000000000000000' + '0000000000000000';
      expect(() => decodeEWKBHex(hex)).toThrow('Z/M coordinates are not supported');
    });

    it('throws on unsupported geometry type', () => {
      // LE typeCode = 7 (GeometryCollection), no SRID
      const hex = '01' + '07000000' + '00000000';
      expect(() => decodeEWKBHex(hex)).toThrow('unsupported geometry type');
    });

    it('throws on invalid byte order marker', () => {
      const hex = '02' + '01000000';
      expect(() => decodeEWKBHex(hex)).toThrow('invalid byte order');
    });

    it('rejects malformed hex pairs', () => {
      // Valid LE Point header followed by a non-hex pair where the X coord starts.
      const hex = '01' + '01000000' + 'gg' + '00000000000000' + '0000000000000000';
      expect(() => decodeEWKBHex(hex)).toThrow('invalid hex byte');
    });

    it('rejects buffers truncated mid-coordinate', () => {
      // LE Point header but only 4 of 16 coordinate bytes present.
      const hex = '01' + '01000000' + '00000000';
      expect(() => decodeEWKBHex(hex)).toThrow('unexpected end of buffer');
    });

    it('rejects trailing bytes after a valid geometry', () => {
      // LE Point at origin without SRID, plus an extra trailing byte.
      const hex = '01' + '01000000' + '0000000000000000' + '0000000000000000' + '00';
      expect(() => decodeEWKBHex(hex)).toThrow('trailing data after geometry');
    });

    it('decodes a MultiLineString without SRID', () => {
      // MultiLineString LE with 1 line of 2 points: (0,0) → (1,1)
      const hex =
        '01' +
        '05000000' + // type MultiLineString
        '01000000' + // numLines = 1
        '01' +
        '02000000' + // sub LineString LE
        '02000000' + // 2 points
        '0000000000000000' +
        '0000000000000000' +
        '000000000000F03F' +
        '000000000000F03F';
      expect(decodeEWKBHex(hex)).toEqual({
        type: 'MultiLineString',
        coordinates: [
          [
            [0, 0],
            [1, 1],
          ],
        ],
      });
    });

    it('decodes a MultiPolygon with SRID', () => {
      // MultiPolygon LE | SRID, 1 polygon with 1 ring of 4 points.
      const hex =
        '01' +
        '06000020' + // type MultiPolygon | SRID
        'E6100000' + // srid 4326
        '01000000' + // numPolygons = 1
        '01' +
        '03000000' + // sub Polygon LE
        '01000000' + // numRings = 1
        '04000000' + // numPoints = 4
        '0000000000000000' +
        '0000000000000000' +
        '000000000000F03F' +
        '0000000000000000' +
        '000000000000F03F' +
        '000000000000F03F' +
        '0000000000000000' +
        '0000000000000000';
      expect(decodeEWKBHex(hex)).toEqual({
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 0],
            ],
          ],
        ],
        srid: 4326,
      });
    });

    it('throws when a MultiPoint contains a non-Point sub-geometry', () => {
      // MultiPoint LE, n=1, sub = LineString (mismatched type).
      const hex =
        '01' +
        '04000000' + // type MultiPoint
        '01000000' + // 1 sub-geometry
        '01' +
        '02000000' + // sub LineString
        '00000000'; // numPoints = 0 (parser throws on type mismatch first)
      expect(() => decodeEWKBHex(hex)).toThrow('MultiPoint contains non-Point');
    });

    it('throws when a MultiLineString contains a non-LineString sub-geometry', () => {
      // MultiLineString LE, n=1, sub = Point.
      const hex =
        '01' +
        '05000000' + // type MultiLineString
        '01000000' + // 1 sub-geometry
        '01' +
        '01000000' + // sub Point
        '0000000000000000' +
        '0000000000000000';
      expect(() => decodeEWKBHex(hex)).toThrow('MultiLineString contains non-LineString');
    });

    it('throws when a MultiPolygon contains a non-Polygon sub-geometry', () => {
      // MultiPolygon LE, n=1, sub = Point.
      const hex =
        '01' +
        '06000000' + // type MultiPolygon
        '01000000' + // 1 sub-geometry
        '01' +
        '01000000' + // sub Point
        '0000000000000000' +
        '0000000000000000';
      expect(() => decodeEWKBHex(hex)).toThrow('MultiPolygon contains non-Polygon');
    });

    it('throws when a Multi* sub-geometry has an unsupported type', () => {
      // MultiPoint LE, n=1, sub = GeometryCollection (type 7) — not a leaf
      // sub-type the parser handles.
      const hex =
        '01' +
        '04000000' + // type MultiPoint
        '01000000' + // 1 sub-geometry
        '01' +
        '07000000'; // sub GeometryCollection (unsupported)
      expect(() => decodeEWKBHex(hex)).toThrow('unsupported sub-type');
    });
  });
});
