import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
import type { ErrorCapturingDriverAdapter } from '@prisma/driver-adapter-utils'
import { Library, QueryEngineInstance } from '../engines/types/Library'
import { JsonQuery } from '../engines/types/JsonProtocol'

export function initQueryEngine(
  driver: ErrorCapturingDriverAdapter,
  prismaSchemaRelativePath: string,
): QueryEngineInstance {
  const dirname = path.dirname(new URL(import.meta.url).pathname)
  const libQueryEnginePath = getLibQueryEnginePath(dirname)

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

export function getLibQueryEnginePath(dirname: String) {
  // I assume nobody will run this on Windows ¯\_(ツ)_/¯
  const libExt = os.platform() === 'darwin' ? 'dylib' : 'so'
  return path.join(dirname, `../../../../../../target/debug/libquery_engine.${libExt}`)
}

export function createQueryFn(engine: QueryEngineInstance, adapter: ErrorCapturingDriverAdapter) {
  return async function doQuery(query: JsonQuery, tx_id?: string) {
    const result = await engine.query(JSON.stringify(query), 'trace', tx_id)
    const parsedResult = JSON.parse(result)
    if (parsedResult.errors) {
      throwAdapterError(parsedResult.errors[0]?.user_facing_error, adapter)
    }
    return parsedResult
  }
}

export function throwAdapterError(error: any, adapter: ErrorCapturingDriverAdapter) {
  if (error.error_code === 'P2036') {
    const jsError = adapter.errorRegistry.consumeError(error.meta.id)
    if (!jsError) {
      throw new Error(
        `Something went wrong. Engine reported external error with id ${error.meta.id}, but it was not registered.`,
      )
    }
    throw jsError.error
  }
}
