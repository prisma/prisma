import { describe, expect, it } from 'vitest';
import { bboxPolygon, point, polygon } from '../src/exports/geojson';

describe('postgis geojson constructors', () => {
  describe('point', () => {
    it('builds a Point without SRID', () => {
      expect(point(1, 2)).toEqual({ type: 'Point', coordinates: [1, 2] });
    });

    it('builds a Point with SRID', () => {
      expect(point(-122.4194, 37.7749, 4326)).toEqual({
        type: 'Point',
        coordinates: [-122.4194, 37.7749],
        srid: 4326,
      });
    });

    it('rejects NaN coordinates', () => {
      expect(() => point(Number.NaN, 0)).toThrow('finite');
      expect(() => point(0, Number.NaN)).toThrow('finite');
    });

    it('rejects Infinity coordinates', () => {
      expect(() => point(Number.POSITIVE_INFINITY, 0)).toThrow('finite');
      expect(() => point(0, Number.NEGATIVE_INFINITY)).toThrow('finite');
    });
  });

  describe('polygon', () => {
    it('closes an open ring automatically', () => {
      const result = polygon([
        [0, 0],
        [1, 0],
        [1, 1],
      ]);
      expect(result.coordinates[0]).toEqual([
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 0],
      ]);
    });

    it('keeps an already-closed ring as-is', () => {
      const ring = [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 0],
      ] as ReadonlyArray<readonly [number, number]>;
      expect(polygon(ring).coordinates[0]).toEqual(ring);
    });

    it('attaches SRID when provided', () => {
      expect(
        polygon(
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
          ],
          4326,
        ).srid,
      ).toBe(4326);
    });

    it('rejects rings with fewer than 3 positions', () => {
      expect(() =>
        polygon([
          [0, 0],
          [1, 1],
        ]),
      ).toThrow('at least 3 positions');
    });

    it('rejects already-closed rings with fewer than 3 distinct positions', () => {
      expect(() =>
        polygon([
          [0, 0],
          [1, 1],
          [0, 0],
        ]),
      ).toThrow('at least 3 distinct positions');
    });

    it('rejects NaN coordinates', () => {
      expect(() =>
        polygon([
          [0, 0],
          [Number.NaN, 1],
          [1, 1],
          [0, 0],
        ]),
      ).toThrow('finite');
    });

    it('rejects Infinity coordinates', () => {
      expect(() =>
        polygon([
          [0, 0],
          [1, 0],
          [Number.POSITIVE_INFINITY, 1],
          [0, 0],
        ]),
      ).toThrow('finite');
    });
  });

  describe('bboxPolygon', () => {
    it('produces a closed rectangle', () => {
      const result = bboxPolygon([0, 0, 10, 10], 4326);
      expect(result).toEqual({
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [10, 0],
            [10, 10],
            [0, 10],
            [0, 0],
          ],
        ],
        srid: 4326,
      });
    });

    it('rejects an inverted bbox (minX > maxX)', () => {
      expect(() => bboxPolygon([10, 0, 0, 10])).toThrow('inverted bbox');
    });

    it('rejects an inverted bbox (minY > maxY)', () => {
      expect(() => bboxPolygon([0, 10, 10, 0])).toThrow('inverted bbox');
    });

    it('rejects NaN coordinates', () => {
      expect(() => bboxPolygon([Number.NaN, 0, 10, 10])).toThrow('finite');
      expect(() => bboxPolygon([0, 0, 10, Number.NaN])).toThrow('finite');
    });

    it('rejects Infinity coordinates', () => {
      expect(() => bboxPolygon([Number.NEGATIVE_INFINITY, 0, 10, 10])).toThrow('finite');
      expect(() => bboxPolygon([0, 0, Number.POSITIVE_INFINITY, 10])).toThrow('finite');
    });
  });
});
