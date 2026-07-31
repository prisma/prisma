import { bboxPolygon } from '@prisma/orm-extension-postgis/geojson';
import { db } from '../prisma/db';

/**
 * Cafes whose `location` falls inside a lat/lng bounding box.
 *
 * Uses the `&&` operator (`intersectsBbox`) which compares 2-D bounding
 * boxes only — fast, index-friendly, and exactly what map UIs want for
 * their viewport queries.
 *
 * @param bbox - `[minLng, minLat, maxLng, maxLat]`.
 */
export function findCafesInBbox(bbox: readonly [number, number, number, number]) {
  const envelope = bboxPolygon(bbox, 4326);
  return db.orm.public.Cafe.where((c) => c.location.intersectsBbox(envelope)).all();
}
