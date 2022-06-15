import path from 'path'
import { Worker } from 'worker_threads'

import { Engine, EngineConfig } from '../common/Engine'
import { PrismaClientError } from '../common/errors/PrismaClientError'
import { PrismaClientInitializationError } from '../common/errors/PrismaClientInitializationError'
import { PrismaClientKnownRequestError } from '../common/errors/PrismaClientKnownRequestError'
import { PrismaClientRustError } from '../common/errors/PrismaClientRustError'
import { PrismaClientRustPanicError } from '../common/errors/PrismaClientRustPanicError'
import { PrismaClientUnknownRequestError } from '../common/errors/PrismaClientUnknownRequestError'
import { WorkerProxy } from './WorkerProxy'

export class WorkerEngine extends WorkerProxy<EngineConfig> implements Engine {
  constructor(config: EngineConfig) {
    super(config)
  }

  createWorker(config: EngineConfig): Worker {
    return new Worker('./LibraryWorker.js', {
      workerData: config,
      env: process.env,
    })
  }

  getConfig = this.bindToWorker('getConfig', { onReject })
  version = this.bindToWorker('version', { onReject })
  request = this.bindToWorker('request', { onReject })
  requestBatch = this.bindToWorker('requestBatch', { onReject })
  transaction = this.bindToWorker('transaction', { onReject })
  metrics = this.bindToWorker('metrics', { onReject })
  start = this.bindToWorker('start', { onReject })
  stop = this.bindToWorker('stop', {
    onResolve: (v) => {
      return this.worker.terminate(), v
    },
    onReject,
  })
  on = this.bindToWorker('on', {
    onExecute: (event, listener) => {
      this.eventEmitter.on(event, listener)
    },
    onReject,
  })
}

function onReject(e: any) {
  if (e !== undefined && typeof e === 'object') {
    const { constructorName, ...error } = e

    if (e.constructorName === 'PrismaClientError') {
      return Object.assign(Object.create(PrismaClientError.prototype), error)
    }
    if (e.constructorName === 'PrismaClientInitializationError') {
      return Object.assign(Object.create(PrismaClientInitializationError.prototype), error)
    }
    if (e.constructorName === 'PrismaClientKnownRequestError') {
      return Object.assign(Object.create(PrismaClientKnownRequestError.prototype), error)
    }
    if (e.constructorName === 'PrismaClientRustError') {
      return Object.assign(Object.create(PrismaClientRustError.prototype), error)
    }
    if (e.constructorName === 'PrismaClientRustPanicError') {
      return Object.assign(Object.create(PrismaClientRustPanicError.prototype), error)
    }
    if (e.constructorName === 'PrismaClientUnknownRequestError') {
      return Object.assign(Object.create(PrismaClientUnknownRequestError.prototype), error)
    }

    return Object.assign(new Error(), error)
  }

  return e
}
