import type { ErrorCapturingDriverAdapter } from '@prisma/driver-adapter-utils'
import * as lib from './engines/Library'
import * as os from 'node:os'
import * as path from 'node:path'

export type QueryLogCallback = (log: string) => void

export function initQueryEngine(adapter: ErrorCapturingDriverAdapter, datamodel: string, queryLogCallback: QueryLogCallback): lib.QueryEngineInstance {
    // I assume nobody will run this on Windows ¯\_(ツ)_/¯
    const libExt = os.platform() === 'darwin' ? 'dylib' : 'so'
    const dirname = path.dirname(new URL(import.meta.url).pathname)

    const libQueryEnginePath = path.join(dirname, `../../../../../target/debug/libquery_engine.${libExt}`)

    const libqueryEngine = { exports: {} as unknown as lib.Library }
    // @ts-ignore
    process.dlopen(libqueryEngine, libQueryEnginePath)

    const QueryEngine = libqueryEngine.exports.QueryEngine

    const queryEngineOptions = {
        datamodel,
        configDir: '.',
        engineProtocol: 'json' as const,
        logLevel: process.env["RUST_LOG"] as any,
        logQueries: true,
        env: process.env,
        ignoreEnvVarErrors: false,
    }

    const logCallback = (event: any) => {
        const parsed = JSON.parse(event)
        if (parsed.is_query) {
            queryLogCallback(parsed.query)
        }
        console.error("[nodejs] ", parsed)
    }
    const engine = new QueryEngine(queryEngineOptions, logCallback, adapter)

    return engine
}
