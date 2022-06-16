import { randomBytes } from 'crypto'
import EventEmitter from 'events'
import { Worker } from 'worker_threads'

type WorkerHooks = {
  onExecute?: (...args: any[]) => Promise<void> | void
  onResolve?: (v: any) => any
  onReject?: (v: any) => any
}

type WorkerMessage =
  | {
      id: string
      data?: any
      error?: any
    }
  | {
      id: undefined
      event: string
      data?: any
    }

type ResultResolvers = Record<
  string,
  {
    resolve: (data: unknown) => void
    reject: (data: unknown) => void
  }
>

/**
 * Used to implement remote control of a class in a worker thread.
 */
export abstract class WorkerProxy<C> {
  private resultResolvers: ResultResolvers = {}
  public readonly eventEmitter = new EventEmitter()
  public readonly worker: Worker

  constructor(config: C) {
    this.eventEmitter = new EventEmitter()
    this.worker = this.createWorker(config)

    this.worker.on('message', (message: WorkerMessage) => {
      if (message.id && this.resultResolvers[message.id]) {
        if ('data' in message) {
          this.resultResolvers[message.id].resolve(message.data)
        }

        if ('error' in message) {
          this.resultResolvers[message.id].reject(message.error)
        }

        delete this.resultResolvers[message.id]
      } else {
        if ('event' in message) {
          this.eventEmitter.emit(message.event, message.data)
        }
      }
    })

    this.worker.on('error', (error) => {
      console.log(error)
    })
  }

  abstract createWorker(config: C): Worker

  bindToWorker(action: string, hooks?: WorkerHooks) {
    return async (...data: any[]) => {
      await hooks?.onExecute?.(...data)
      return new Promise((resolve, reject) => {
        const id = randomBytes(8).toString('hex')
        this.worker.postMessage({ id, action, data })
        this.resultResolvers[id] = { resolve, reject }
      })
        .then((v) => {
          return hooks?.onResolve ? hooks?.onResolve(v) : v
        })
        .catch((e) => {
          throw hooks?.onReject ? hooks?.onReject(e) : e
        })
    }
  }
}
