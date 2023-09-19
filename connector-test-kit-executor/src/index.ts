import pgDriver from 'pg'
import * as pg from '@jkomyno/prisma-adapter-pg'
import * as qe from './qe'
import * as engines from './engines/Library'
import * as readline from 'node:readline'
import * as jsonRpc from './jsonRpc'
import {bindAdapter, ErrorCapturingDriverAdapter} from "@jkomyno/prisma-driver-adapter-utils";

async function main(): Promise<void> {
    const iface = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false,
    });

    iface.on('line', async (line) => {
        try {
            const request: jsonRpc.Request = JSON.parse(line); // todo: validate
            console.error(`Got a request: ${line}`)
            try {
                const response = await handleRequest(request.method, request.params)
                respondOk(request.id, response)
            } catch (err) {
                console.error("[nodejs] Error from request handler: ", err)
                respondErr(request.id, {
                    code: 1,
                    message: err.toString(),
                })
            }
        } catch (_) {
            // skip non-JSON line
        }

    });
}

const schemas: Record<number, engines.QueryEngineInstance> = {}
const adapters: Record<number, ErrorCapturingDriverAdapter> = {}
const queryLogs: Record<number, string[]> = []

async function handleRequest(method: string, params: unknown): Promise<unknown> {
    switch (method) {
        case 'initializeSchema': {
            interface InitializeSchemaParams {
                schema: string
                schemaId: string
                url: string
            }

            const castParams = params as InitializeSchemaParams;
            const logs = queryLogs[castParams.schemaId] = [] as string[]
            const [engine, adapter] = await initQe(castParams.url, castParams.schema, (log) => {
                logs.push(log)
            });
            await engine.connect("")
            schemas[castParams.schemaId] = engine
            adapters[castParams.schemaId] = adapter
            return null
        }
        case 'query': {
            interface QueryPayload {
                query: string
                schemaId: number
                txId?: string
            }

            console.error("Got `query`", params)
            const castParams = params as QueryPayload;
            const engine = schemas[castParams.schemaId]
            const result = await engine.query(JSON.stringify(castParams.query), "", castParams.txId)

            const parsedResult = JSON.parse(result)
            if (parsedResult.errors) {
                const error = parsedResult.errors[0]?.user_facing_error
                if (error.error_code === 'P2036') {
                    const jsError = adapters[castParams.schemaId].errorRegistry.consumeError(error.meta.id)
                    if (!jsError) {
                        console.error(`Something went wrong. Engine reported external error with id ${error.meta.id}, but it was not registered.`)
                    } else {
                        console.error("[nodejs] got error response from the engine caused by the driver: ", jsError)
                    }
                }
            }

            console.error("[nodejs] got response from engine: ", result)

            // returning unparsed string: otherwise, some information gots lost during this round-trip. 
            // In particular, floating point without decimal part turn into integers
            return result
        }

        case 'startTx': {
            interface StartTxPayload {
                schemaId: number,
                options: unknown
            }
            console.error("Got `startTx", params)
            const { schemaId, options } = params as StartTxPayload
            const result = await schemas[schemaId].startTransaction(JSON.stringify(options), "")
            return JSON.parse(result)

            

        }

        case 'commitTx': {
            interface CommitTxPayload {
                schemaId: number,
                txId: string,
            }
            console.error("Got `commitTx", params)
            const { schemaId, txId } = params as CommitTxPayload
            const result = await schemas[schemaId].commitTransaction(txId, '{}')
            return JSON.parse(result)
        }

        case 'rollbackTx': {
            interface RollbackTxPayload {
                schemaId: number,
                txId: string,
            }
            console.error("Got `rollbackTx", params)
            const { schemaId, txId } = params as RollbackTxPayload
            const result = await schemas[schemaId].rollbackTransaction(txId, '{}')
            return JSON.parse(result)
        }
        case 'teardown': {
            interface TeardownPayload {
                schemaId: number
            }

            const castParams = params as TeardownPayload;
            await schemas[castParams.schemaId].disconnect("")
            delete schemas[castParams.schemaId]
            delete queryLogs[castParams.schemaId]
            return {}

        }

        case 'getLogs': {
            interface GetLogsPayload {
                schemaId: number
            }
            const castParams = params as GetLogsPayload
            return queryLogs[castParams.schemaId] ?? []
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
    const pool = new pgDriver.Pool({ connectionString: url })
    const adapter = bindAdapter(new pg.PrismaPg(pool))
    const engineInstance = qe.initQueryEngine(adapter, prismaSchema, logCallback)
    return [engineInstance, adapter];
}

main().catch(console.error)
