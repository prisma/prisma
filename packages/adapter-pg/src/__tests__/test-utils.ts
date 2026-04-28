import type { Geometry, LineString, Point, Polygon } from '@prisma/driver-adapter-utils'

/**
 * Type guard to check if value is a valid Geometry object.
 * Used in tests to verify geometry structure.
 */
export function isGeometry(value: unknown): value is Geometry {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    'coordinates' in value &&
    typeof (value as { type: unknown }).type === 'string'
  )
}

/**
 * Create a Point geometry for testing.
 */
export function createPoint(x: number, y: number, srid?: number): Point {
  return { type: 'Point', coordinates: [x, y], srid }
}

/**
 * Create a LineString geometry for testing.
 */
export function createLineString(coords: [number, number][], srid?: number): LineString {
  return { type: 'LineString', coordinates: coords, srid }
}

/**
 * Create a Polygon geometry for testing.
 */
export function createPolygon(rings: [number, number][][], srid?: number): Polygon {
  return { type: 'Polygon', coordinates: rings, srid }
}

/**
 * Create a simple rectangular polygon for testing.
 */
export function createRectangle(minX: number, minY: number, maxX: number, maxY: number, srid?: number): Polygon {
  return createPolygon(
    [
      [
        [minX, minY],
        [maxX, minY],
        [maxX, maxY],
        [minX, maxY],
        [minX, minY],
      ],
    ],
    srid,
  )
}
