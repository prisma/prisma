import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
import type { ErrorCapturingDriverAdapter } from '@jkomyno/prisma-driver-adapter-utils'
import { Library, QueryEngineInstance } from '../engines/types/Library'

export function initQueryEngine(driver: ErrorCapturingDriverAdapter, prismaSchemaRelativePath: string): QueryEngineInstance {
  // I assume nobody will run this on Windows ¯\_(ツ)_/¯
  const libExt = os.platform() === 'darwin' ? 'dylib' : 'so'
  const dirname = path.dirname(new URL(import.meta.url).pathname)

  const libQueryEnginePath = path.join(dirname, `../../../../../../target/debug/libquery_engine.${libExt}`)
  const schemaPath = path.join(dirname, prismaSchemaRelativePath)

  console.log('[nodejs] read Prisma schema from', schemaPath)

  const libqueryEngine = { exports: {} as unknown as Library }
  // @ts-ignore
  process.dlopen(libqueryEngine, libQueryEnginePath)

  const QueryEngine = libqueryEngine.exports.QueryEngine

  const queryEngineOptions = {
    datamodel: fs.readFileSync(schemaPath, 'utf-8'),
    configDir: '.',
    engineProtocol: 'json' as const,
    logLevel: 'info' as const,
    logQueries: false,
    env: process.env,
    ignoreEnvVarErrors: false,
  }

  const logCallback = (...args) => {
    console.log(args)
  }

  const engine = new QueryEngine(queryEngineOptions, logCallback, driver)

  return engine
}
