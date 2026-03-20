/**
 * Represents a geometric point in 2D or 3D space.
 * Compatible with GeoJSON Point geometry.
 */
export interface Point {
  readonly type: 'Point'
  readonly coordinates: [number, number] | [number, number, number]
  readonly srid?: number
}

/**
 * Represents a line string (sequence of points).
 * Compatible with GeoJSON LineString geometry.
 */
export interface LineString {
  readonly type: 'LineString'
  readonly coordinates: Point['coordinates'][]
  readonly srid?: number
}

/**
 * Represents a polygon (exterior ring and optional holes).
 * Compatible with GeoJSON Polygon geometry.
 */
export interface Polygon {
  readonly type: 'Polygon'
  readonly coordinates: Point['coordinates'][][]
  readonly srid?: number
}

/**
 * Union type for all supported geometry types.
 * Expandable to support MultiPoint, MultiLineString, etc.
 */
export type Geometry = Point | LineString | Polygon

/**
 * Input variant of geometry types.
 * Unlike `Geometry`, this type allows undefined and read-only properties.
 * Used for create and update operations where geometry fields are provided.
 */
export type InputGeometry = {
  readonly type: string
  readonly coordinates: unknown
  readonly srid?: number
}
