import * as qe from './qe'
import * as engines from './engines/Library'
import * as readline from 'node:readline'
import * as jsonRpc from './jsonRpc'

// pg dependencies
import pgDriver from 'pg'
import * as prismaPg from '@prisma/adapter-pg'

// neon dependencies
import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless'
import { WebSocket } from 'undici'
import * as prismaNeon from '@prisma/adapter-neon'

import {bindAdapter, DriverAdapter, ErrorCapturingDriverAdapter} from "@prisma/driver-adapter-utils";

const SUPPORTED_ADAPTERS: Record<string, (_ : string) => Promise<DriverAdapter>>
    = {"pg": pgAdapter, "neon:ws" : neonWsAdapter};

// conditional debug logging based on LOG_LEVEL env var
const debug = (() => {
    if ((process.env.LOG_LEVEL ?? '').toLowerCase() != 'debug') {
        return (...args: any[]) => {}
    }

    return (...args: any[]) => {
        console.error('[nodejs] DEBUG:', ...args);
    };
})();

// error logger
const err = (...args: any[]) => console.error('[nodejs] ERROR:', ...args);


async function main(): Promise<void> {
    const iface = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false,
    });

    iface.on('line', async (line) => {
        try {
            const request: jsonRpc.Request = JSON.parse(line); // todo: validate
            debug(`Got a request: ${line}`)
            try {
                const response = await handleRequest(request.method, request.params)
                respondOk(request.id, response)
            } catch (err) {
                debug("[nodejs] Error from request handler: ", err)
                respondErr(request.id, {
                    code: 1,
                    message: err.toString(),
                })
            }
        } catch (err) {
            debug("Received non-json line: ", line);
        }

    });
}

const state: Record<number, {
    engine: engines.QueryEngineInstance,
    adapter: ErrorCapturingDriverAdapter,
    queryLogs: string[]
}> = {}

async function handleRequest(method: string, params: unknown): Promise<unknown> {
    switch (method) {
        case 'initializeSchema': {
            interface InitializeSchemaParams {
                schema: string
                schemaId: string
                url: string
            }

            const castParams = params as InitializeSchemaParams;
            const logs = [] as string[]
            const [engine, adapter] = await initQe(castParams.url, castParams.schema, (log) => {
                logs.push(log)
            });
            await engine.connect("")

            state[castParams.schemaId] = {
                engine,
                adapter,
                logs
            }
            return null
        }
        case 'query': {
            interface QueryPayload {
                query: string
                schemaId: number
                txId?: string
            }

            debug("Got `query`", params)
            const castParams = params as QueryPayload;
            const engine = state[castParams.schemaId].engine
            const result = await engine.query(JSON.stringify(castParams.query), "", castParams.txId)

            const parsedResult = JSON.parse(result)
            if (parsedResult.errors) {
                const error = parsedResult.errors[0]?.user_facing_error
                if (error.error_code === 'P2036') {
                    const jsError = state[castParams.schemaId].adapter.errorRegistry.consumeError(error.meta.id)
                    if (!jsError) {
                        err(`Something went wrong. Engine reported external error with id ${error.meta.id}, but it was not registered.`)
                    } else {
                        err("got error response from the engine caused by the driver: ", jsError)
                    }
                }
            }

            debug("got response from engine: ", result)
            // returning unparsed string: otherwise, some information gots lost during this round-trip. 
            // In particular, floating point without decimal part turn into integers
            return result
        }

        case 'startTx': {
            interface StartTxPayload {
                schemaId: number,
                options: unknown
            }

            debug("Got `startTx", params)
            const {schemaId, options} = params as StartTxPayload
            const result = await state[schemaId].engine.startTransaction(JSON.stringify(options), "")
            return JSON.parse(result)
        }

        case 'commitTx': {
            interface CommitTxPayload {
                schemaId: number,
                txId: string,
            }

            debug("Got `commitTx", params)
            const {schemaId, txId} = params as CommitTxPayload
            const result = await state[schemaId].engine.commitTransaction(txId, '{}')
            return JSON.parse(result)
        }

        case 'rollbackTx': {
            interface RollbackTxPayload {
                schemaId: number,
                txId: string,
            }

            debug("Got `rollbackTx", params)
            const {schemaId, txId} = params as RollbackTxPayload
            const result = await state[schemaId].engine.rollbackTransaction(txId, '{}')
            return JSON.parse(result)
        }
        case 'teardown': {
            interface TeardownPayload {
                schemaId: number
            }

            debug("Got `teardown", params)
            const castParams = params as TeardownPayload;
            await state[castParams.schemaId].engine.disconnect("")
            delete state[castParams.schemaId]

            return {}
        }
        case 'getLogs': {
            interface GetLogsPayload {
                schemaId: number
            }

            const castParams = params as GetLogsPayload
            return state[castParams.schemaId].queryLogs ?? []
        }
        default: {
            throw new Error(`Unknown method: \`${method}\``)
        }
    }
}

function respondErr(requestId: number, error: jsonRpc.RpcError) {
    const msg: jsonRpc.ErrResponse = {
        jsonrpc: '2.0',
        id: requestId,
        error,
    }
    console.log(JSON.stringify(msg))
}

function respondOk(requestId: number, payload: unknown) {
    const msg: jsonRpc.OkResponse = {
        jsonrpc: '2.0',
        id: requestId,
        result: payload

    };
    console.log(JSON.stringify(msg))
}

async function initQe(url: string, prismaSchema: string, logCallback: qe.QueryLogCallback): Promise<[engines.QueryEngineInstance, ErrorCapturingDriverAdapter]> {
    const adapter = await adapterFromEnv(url) as DriverAdapter
    const errorCapturingAdapter = bindAdapter(adapter)
    const engineInstance = qe.initQueryEngine(errorCapturingAdapter, prismaSchema, logCallback, debug)
    return [engineInstance, errorCapturingAdapter];
}

async function adapterFromEnv(url: string): Promise<DriverAdapter> {
    const adapter = process.env.DRIVER_ADAPTER ?? ''

    if (adapter == '') {
        throw new Error("DRIVER_ADAPTER is not defined or empty.")
    }

    if (!(adapter in SUPPORTED_ADAPTERS)) {
        throw new Error(`Unsupported driver adapter: ${adapter}`)
    }

    return await SUPPORTED_ADAPTERS[adapter](url)
}

async function pgAdapter(url: string): Promise<DriverAdapter> {
    const pool = new pgDriver.Pool({connectionString: url})
    return new prismaPg.PrismaPg(pool)
}

async function neonWsAdapter(url: string): Promise<DriverAdapter> {
    const proxyURL = JSON.parse(process.env.DRIVER_ADAPTER_CONFIG || '{}').proxyUrl ?? ''
    if (proxyURL == '') {
        throw new Error("DRIVER_ADAPTER_URL_OVERRIDE is not defined or empty, but its required for neon adapter.");
    }

    neonConfig.wsProxy = () => `127.0.0.1:5488/v1`
    neonConfig.webSocketConstructor = WebSocket
    neonConfig.useSecureWebSocket = false
    neonConfig.pipelineConnect = false

    const pool = new NeonPool({ connectionString: url })
    return new prismaNeon.PrismaNeon(pool)
}

main().catch(err)
