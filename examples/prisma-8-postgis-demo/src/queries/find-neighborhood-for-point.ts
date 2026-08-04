import type { Geometry } from '@prisma/orm-extension-postgis/codec-types';
import { db } from '../prisma/db';

/**
 * Reverse geocoding by polygon: which neighborhoods contain this point?
 *
 * SQL: WHERE ST_Contains(boundary, $point)
 */
export function findNeighborhoodForPoint(point: Geometry) {
  return db.orm.public.Neighborhood.where((n) => n.boundary.contains(point)).all();
}
