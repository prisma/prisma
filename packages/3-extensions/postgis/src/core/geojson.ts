/**
 * GeoJSON-shaped value types used by the PostGIS codec.
 *
 * The codec speaks GeoJSON-style objects to JavaScript callers and
 * EWKT/EWKB on the wire. This file is the single source of truth for the
 * value shapes; the public type re-export lives in `exports/geojson.ts`.
 */

import { postgisError } from './errors';

export type Position = readonly [number, number];

export type GeometryPoint = {
  readonly type: 'Point';
  readonly coordinates: Position;
  readonly srid?: number;
};

export type GeometryLineString = {
  readonly type: 'LineString';
  readonly coordinates: ReadonlyArray<Position>;
  readonly srid?: number;
};

export type GeometryPolygon = {
  readonly type: 'Polygon';
  readonly coordinates: ReadonlyArray<ReadonlyArray<Position>>;
  readonly srid?: number;
};

export type GeometryMultiPoint = {
  readonly type: 'MultiPoint';
  readonly coordinates: ReadonlyArray<Position>;
  readonly srid?: number;
};

export type GeometryMultiLineString = {
  readonly type: 'MultiLineString';
  readonly coordinates: ReadonlyArray<ReadonlyArray<Position>>;
  readonly srid?: number;
};

export type GeometryMultiPolygon = {
  readonly type: 'MultiPolygon';
  readonly coordinates: ReadonlyArray<ReadonlyArray<ReadonlyArray<Position>>>;
  readonly srid?: number;
};

export type Geometry =
  | GeometryPoint
  | GeometryLineString
  | GeometryPolygon
  | GeometryMultiPoint
  | GeometryMultiLineString
  | GeometryMultiPolygon;

/**
 * Construct a Point. Convenience for the common "lng/lat" case.
 *
 * @example
 *   point(-122.4194, 37.7749, 4326)
 */
export function point(longitude: number, latitude: number, srid?: number): GeometryPoint {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    throw postgisError('POSTGIS.GEOMETRY_INVALID', 'point: coordinates must be finite numbers', {
      meta: { helper: 'point', reason: 'non-finite coordinates' },
    });
  }
  return srid !== undefined
    ? { type: 'Point', coordinates: [longitude, latitude], srid }
    : { type: 'Point', coordinates: [longitude, latitude] };
}

/**
 * Construct a Polygon from a single outer ring of `[lng, lat]` pairs.
 * If the first and last positions differ, the ring is closed automatically.
 */
export function polygon(ring: ReadonlyArray<Position>, srid?: number): GeometryPolygon {
  if (ring.length < 3) {
    throw postgisError(
      'POSTGIS.GEOMETRY_INVALID',
      'polygon: ring must contain at least 3 positions',
      { meta: { helper: 'polygon', reason: 'ring under 3 positions' } },
    );
  }
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (!first || !last) {
    throw postgisError('POSTGIS.GEOMETRY_INVALID', 'polygon: ring positions cannot be undefined', {
      meta: { helper: 'polygon', reason: 'undefined ring position' },
    });
  }
  for (const position of ring) {
    if (!Number.isFinite(position[0]) || !Number.isFinite(position[1])) {
      throw postgisError(
        'POSTGIS.GEOMETRY_INVALID',
        'polygon: coordinates must be finite numbers',
        { meta: { helper: 'polygon', reason: 'non-finite coordinates' } },
      );
    }
  }
  const closed = first[0] === last[0] && first[1] === last[1] ? ring : [...ring, first];
  const distinct = new Set(closed.slice(0, -1).map(([x, y]) => `${x},${y}`));
  if (distinct.size < 3) {
    throw postgisError(
      'POSTGIS.GEOMETRY_INVALID',
      'polygon: ring must contain at least 3 distinct positions',
      { meta: { helper: 'polygon', reason: 'ring under 3 distinct positions' } },
    );
  }
  return srid !== undefined
    ? { type: 'Polygon', coordinates: [closed], srid }
    : { type: 'Polygon', coordinates: [closed] };
}

/**
 * Construct a rectangular Polygon from a bounding box.
 *
 * @param bbox - `[minLng, minLat, maxLng, maxLat]`
 */
export function bboxPolygon(
  bbox: readonly [number, number, number, number],
  srid?: number,
): GeometryPolygon {
  const [minX, minY, maxX, maxY] = bbox;
  if (
    !Number.isFinite(minX) ||
    !Number.isFinite(minY) ||
    !Number.isFinite(maxX) ||
    !Number.isFinite(maxY)
  ) {
    throw postgisError(
      'POSTGIS.GEOMETRY_INVALID',
      'bboxPolygon: coordinates must be finite numbers',
      { meta: { helper: 'bboxPolygon', reason: 'non-finite coordinates' } },
    );
  }
  if (minX > maxX || minY > maxY) {
    throw postgisError(
      'POSTGIS.GEOMETRY_INVALID',
      `bboxPolygon: inverted bbox [${minX}, ${minY}, ${maxX}, ${maxY}] (expected minX <= maxX and minY <= maxY)`,
      { meta: { helper: 'bboxPolygon', reason: 'inverted bbox' } },
    );
  }
  return polygon(
    [
      [minX, minY],
      [maxX, minY],
      [maxX, maxY],
      [minX, maxY],
      [minX, minY],
    ],
    srid,
  );
}
