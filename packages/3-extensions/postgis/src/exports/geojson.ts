/**
 * GeoJSON-shaped value types and constructors used by the PostGIS codec.
 *
 * Surface these so callers can produce well-formed point/polygon values
 * without depending on internal modules.
 */

export type {
  Geometry,
  GeometryLineString,
  GeometryMultiLineString,
  GeometryMultiPoint,
  GeometryMultiPolygon,
  GeometryPoint,
  GeometryPolygon,
  Position,
} from '../core/geojson';

export { bboxPolygon, point, polygon } from '../core/geojson';
