import type { Geometry } from '@prisma/orm-extension-postgis/codec-types';
import { db } from '../prisma/db';

/**
 * Routes whose path intersects another geometry — typically a polygon
 * (e.g., a closure zone) or another route's LineString.
 *
 * SQL: WHERE ST_Intersects(path, $other)
 */
export function findRoutesIntersecting(other: Geometry) {
  return db.orm.public.Route.where((r) => r.path.intersects(other)).all();
}
