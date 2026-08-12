import type { Db } from '../db';

export function findLocations(db: Db) {
  return db.orm.locations.all();
}
