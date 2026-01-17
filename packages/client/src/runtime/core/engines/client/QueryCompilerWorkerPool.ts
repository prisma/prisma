import os from 'node:os'
import path from 'node:path'
import { Worker } from 'node:worker_threads'

import type { QueryCompilerOptions } from '@prisma/client-common'
import type { BatchResponse, QueryPlanNode } from '@prisma/client-engine-runtime'

import type { QueryCompilerWorkerData, WorkerMessage, WorkerResponse } from './query-compiler-worker'

interface PendingRequest {
  resolve: (result: QueryPlanNode | BatchResponse) => void
  reject: (error: Error) => void
}

interface PoolWorker {
  worker: Worker
  pendingRequests: Map<number, PendingRequest>
  ready: boolean
}

export interface QueryCompilerWorkerPoolConfig {
  compilerOptions: QueryCompilerOptions
  wasmModule: WebAssembly.Module
  runtimePath: string
  importName: string
  /**
   * Number of workers in the pool. Defaults to the number of CPU cores,
   * capped at 4 to avoid excessive memory usage.
   */
  poolSize?: number
}

const DEFAULT_MAX_POOL_SIZE = 4

export class QueryCompilerWorkerPool {
  readonly #config: QueryCompilerWorkerPoolConfig
  readonly #workers: PoolWorker[] = []
  readonly #poolSize: number
  #nextRequestId = 0
  #readyPromise: Promise<void>
  #resolveReady!: () => void
  #rejectReady!: (error: Error) => void
  #readyCount = 0
  #terminated = false
  #lastPanicMessage: string | undefined

  constructor(config: QueryCompilerWorkerPoolConfig) {
    this.#config = config
    this.#poolSize = config.poolSize ?? Math.min(os.cpus().length, DEFAULT_MAX_POOL_SIZE)

    this.#readyPromise = new Promise((resolve, reject) => {
      this.#resolveReady = resolve
      this.#rejectReady = reject
    })

    this.#spawnWorkers()
  }

  #spawnWorkers(): void {
    for (let i = 0; i < this.#poolSize; i++) {
      this.#spawnWorker()
    }
  }

  #spawnWorker(): void {
    // Determine the correct worker file extension based on the current module format.
    // In ESM, __filename ends with .mjs; in CJS, it ends with .js
    const isESM = typeof __filename === 'string' && __filename.endsWith('.mjs')
    const workerExt = isESM ? '.mjs' : '.js'
    const workerPath = path.join(__dirname, `query-compiler-worker${workerExt}`)

    const workerData: QueryCompilerWorkerData = {
      compilerOptions: this.#config.compilerOptions,
      wasmModule: this.#config.wasmModule,
      runtimePath: this.#config.runtimePath,
      importName: this.#config.importName,
    }

    const worker = new Worker(workerPath, { workerData })

    const poolWorker: PoolWorker = {
      worker,
      pendingRequests: new Map(),
      ready: false,
    }

    this.#workers.push(poolWorker)

    worker.on('message', (response: WorkerResponse) => {
      this.#handleResponse(poolWorker, response)
    })

    worker.on('error', (error) => {
      this.#handleWorkerError(poolWorker, error)
    })

    worker.on('exit', (code) => {
      if (!this.#terminated && code !== 0) {
        this.#handleWorkerExit(poolWorker, code)
      }
    })
  }

  #handleResponse(poolWorker: PoolWorker, response: WorkerResponse): void {
    if (response.type === 'ready') {
      poolWorker.ready = true
      this.#readyCount++

      // Resolve when all workers are ready
      if (this.#readyCount === this.#poolSize) {
        this.#resolveReady()
      }
      return
    }

    const pending = poolWorker.pendingRequests.get(response.id)
    if (!pending) {
      return
    }
    poolWorker.pendingRequests.delete(response.id)

    switch (response.type) {
      case 'result':
        pending.resolve(response.result)
        break
      case 'error':
        pending.reject(new Error(response.error))
        break
      case 'panic':
        this.#lastPanicMessage = response.message
        pending.reject(new QueryCompilerWorkerPanicError(response.message))
        break
    }
  }

  #handleWorkerError(poolWorker: PoolWorker, error: Error): void {
    // If not all workers are ready yet, reject the ready promise
    if (this.#readyCount < this.#poolSize) {
      this.#rejectReady(error)
    }

    // Reject all pending requests for this worker
    for (const [, pending] of poolWorker.pendingRequests) {
      pending.reject(error)
    }
    poolWorker.pendingRequests.clear()
  }

  #handleWorkerExit(poolWorker: PoolWorker, code: number): void {
    const error = new Error(`Query compiler worker exited unexpectedly with code ${code}`)
    this.#handleWorkerError(poolWorker, error)
  }

  /**
   * Select the worker with the fewest pending requests (least busy).
   */
  #selectWorker(): PoolWorker {
    let minPending = Infinity
    let selectedWorker = this.#workers[0]

    for (const poolWorker of this.#workers) {
      if (poolWorker.ready && poolWorker.pendingRequests.size < minPending) {
        minPending = poolWorker.pendingRequests.size
        selectedWorker = poolWorker

        // If we find a worker with no pending requests, use it immediately
        if (minPending === 0) {
          break
        }
      }
    }

    return selectedWorker
  }

  async #ensureReady(): Promise<void> {
    if (this.#terminated) {
      throw new Error('QueryCompilerWorkerPool has been terminated')
    }
    await this.#readyPromise
  }

  async compile(request: string): Promise<QueryPlanNode> {
    await this.#ensureReady()

    const id = this.#nextRequestId++
    const message: WorkerMessage = { type: 'compile', id, request }
    const poolWorker = this.#selectWorker()

    return new Promise((resolve, reject) => {
      poolWorker.pendingRequests.set(id, {
        resolve: resolve as (result: QueryPlanNode | BatchResponse) => void,
        reject,
      })
      poolWorker.worker.postMessage(message)
    })
  }

  async compileBatch(request: string): Promise<BatchResponse> {
    await this.#ensureReady()

    const id = this.#nextRequestId++
    const message: WorkerMessage = { type: 'compileBatch', id, request }
    const poolWorker = this.#selectWorker()

    return new Promise((resolve, reject) => {
      poolWorker.pendingRequests.set(id, {
        resolve: resolve as (result: QueryPlanNode | BatchResponse) => void,
        reject,
      })
      poolWorker.worker.postMessage(message)
    })
  }

  /**
   * Returns the last panic message if a panic occurred, or undefined if no panic occurred.
   * After calling this method, the panic message is cleared.
   */
  getAndClearPanicMessage(): string | undefined {
    const message = this.#lastPanicMessage
    this.#lastPanicMessage = undefined
    return message
  }

  /**
   * Returns the number of workers in the pool.
   */
  get poolSize(): number {
    return this.#poolSize
  }

  async terminate(): Promise<void> {
    if (this.#terminated) {
      return
    }
    this.#terminated = true

    const terminatePromises: Promise<number>[] = []

    for (const poolWorker of this.#workers) {
      terminatePromises.push(poolWorker.worker.terminate())

      // Reject all pending requests
      const error = new Error('QueryCompilerWorkerPool was terminated')
      for (const [, pending] of poolWorker.pendingRequests) {
        pending.reject(error)
      }
      poolWorker.pendingRequests.clear()
    }

    await Promise.all(terminatePromises)
    this.#workers.length = 0
  }
}

export class QueryCompilerWorkerPanicError extends Error {
  readonly isPanic = true

  constructor(message: string) {
    super(message)
    this.name = 'QueryCompilerWorkerPanicError'
  }
}
