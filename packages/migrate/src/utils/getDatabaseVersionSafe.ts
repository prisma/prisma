import Debug from '@prisma/debug'
import type { MigrateTypes } from '@prisma/internals'

import { SchemaEngine } from '../SchemaEngine'

const debug = Debug('prisma:cli')

/**
 * Retrieve the database version from the given schema or url.
 * This function never throws, and was introduced to prevent circular dependencies in `@prisma/internals`.
 */
export async function getDatabaseVersionSafe(
  args: MigrateTypes.GetDatabaseVersionParams | undefined,
): Promise<string | undefined> {
  let engine: SchemaEngine | undefined
  let dbVersion: string | undefined
  try {
    engine = new SchemaEngine({})
    dbVersion = await engine.getDatabaseVersion(args)
  } catch (e) {
    debug(e)
  } finally {
    if (engine?.isRunning) {
      engine.stop()
    }
  }

  return dbVersion
}
