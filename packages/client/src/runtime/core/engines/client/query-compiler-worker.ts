import { parentPort, workerData } from 'node:worker_threads'

import type { QueryCompiler, QueryCompilerOptions } from '@prisma/client-common'
import type { BatchResponse, QueryPlanNode } from '@prisma/client-engine-runtime'

type WorkerMessage =
  | { type: 'compile'; id: number; request: string }
  | { type: 'compileBatch'; id: number; request: string }

type WorkerResponse =
  | { type: 'result'; id: number; result: QueryPlanNode | BatchResponse }
  | { type: 'error'; id: number; error: string }
  | { type: 'panic'; id: number; message: string }
  | { type: 'ready' }

interface QueryCompilerWorkerData {
  compilerOptions: QueryCompilerOptions
  wasmModule: WebAssembly.Module
  runtimePath: string
  importName: string
}

const data = workerData as QueryCompilerWorkerData

let compiler: QueryCompiler
let panicMessage: string | undefined

  // Set up the panic handler for this worker
;(globalThis as any).PRISMA_WASM_PANIC_REGISTRY = {
  set_message(message: string) {
    panicMessage = message
  },
}

async function initializeCompiler(): Promise<void> {
  // Dynamically import the wasm-bindgen runtime module
  const runtime = await import(data.runtimePath)

  const options = { [data.importName]: runtime }
  const instance = new WebAssembly.Instance(data.wasmModule, options)
  const wbindgen_start = instance.exports.__wbindgen_start as () => void
  runtime.__wbg_set_wasm(instance.exports)
  wbindgen_start()

  compiler = new runtime.QueryCompiler(data.compilerOptions)
}

function handleMessage(message: WorkerMessage): void {
  panicMessage = undefined

  try {
    let result: QueryPlanNode | BatchResponse

    if (message.type === 'compile') {
      result = compiler.compile(message.request) as QueryPlanNode
    } else {
      result = compiler.compileBatch(message.request)
    }

    if (panicMessage !== undefined) {
      parentPort!.postMessage({
        type: 'panic',
        id: message.id,
        message: panicMessage,
      } satisfies WorkerResponse)
    } else {
      parentPort!.postMessage({
        type: 'result',
        id: message.id,
        result,
      } satisfies WorkerResponse)
    }
  } catch (error) {
    if (panicMessage !== undefined) {
      parentPort!.postMessage({
        type: 'panic',
        id: message.id,
        message: panicMessage,
      } satisfies WorkerResponse)
    } else {
      parentPort!.postMessage({
        type: 'error',
        id: message.id,
        error: error instanceof Error ? error.message : String(error),
      } satisfies WorkerResponse)
    }
  }
}

initializeCompiler()
  .then(() => {
    parentPort!.on('message', handleMessage)
    parentPort!.postMessage({ type: 'ready' } satisfies WorkerResponse)
  })
  .catch((error) => {
    const errorMessage = error instanceof Error ? error.message : String(error)
    parentPort!.postMessage({
      type: 'error',
      id: -1,
      error: `Failed to initialize query compiler in worker: ${errorMessage}`,
    } satisfies WorkerResponse)
  })

export type { QueryCompilerWorkerData, WorkerMessage, WorkerResponse }
