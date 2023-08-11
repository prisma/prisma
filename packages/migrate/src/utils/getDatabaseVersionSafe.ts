import Debug from '@prisma/debug'

import { SchemaEngine } from '../SchemaEngine'
import type { EngineArgs } from '../types'

const debug = Debug('prisma:cli')

/**
 * Retrieve the database version from the given schema or url.
 * This function never throws, and was introduced to prevent circular dependencies in `@prisma/internals`.
 */
export async function getDatabaseVersionSafe(args: EngineArgs.GetDatabaseVersionParams): Promise<string | undefined> {
  let engine: SchemaEngine | undefined
  let dbVersion: string | undefined
  try {
    engine = new SchemaEngine({
      projectDir: process.cwd(),
    })
    dbVersion = await engine.getDatabaseVersion(args)
  } catch (e) {
    debug(e)
  } finally {
    if (engine && engine.isRunning) {
      engine.stop()
    }
  }

  return dbVersion
}
