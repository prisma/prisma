interface Job {
  resolve: (data: any) => void
  reject: (data: any) => void
  request: any
}

export type DataLoaderOptions<T> = {
  singleLoader: (request: T) => Promise<any>
  batchLoader: (request: T[]) => Promise<any[]>
  canBatch?: (request: T) => boolean
  batchBy: (request: T) => string | undefined
  // Specifies the order in which requests in a batch would
  // be sorted. See Array.prototype.sort callback
  batchOrder: (requestA: T, requestB: T) => number
}

export class DataLoader<T = unknown> {
  batches: { [key: string]: Job[] }
  #deferredBatch?: Job[]
  private tickActive = false
  constructor(private options: DataLoaderOptions<T>) {
    this.batches = {}
  }

  request(request: T): Promise<any> {
    if (this.options.canBatch?.(request)) {
      return new Promise((resolve, reject) => {
        this.#deferredBatch ??= []
        this.#deferredBatch.push({
          request,
          resolve,
          reject,
        })
        this.scheduleDispatch()
      })
    }

    const hash = this.options.batchBy(request)
    if (!hash) {
      return this.options.singleLoader(request)
    }
    if (!this.batches[hash]) {
      this.batches[hash] = []

      this.scheduleDispatch()
    }

    return new Promise((resolve, reject) => {
      this.batches[hash].push({
        request,
        resolve,
        reject,
      })
    })
  }

  private scheduleDispatch() {
    // make sure, that we only tick once at a time
    if (!this.tickActive) {
      this.tickActive = true
      queueMicrotask(() => {
        this.dispatchBatches()
        this.tickActive = false
      })
    }
  }

  private dispatchBatches() {
    const deferredBatch = this.#deferredBatch
    this.#deferredBatch = undefined

    if (deferredBatch !== undefined) {
      if (deferredBatch.length === 1) {
        this.dispatchSingle(deferredBatch[0])
      } else if (deferredBatch.length !== 2 || !this.dispatchTwoDeferredJobs(deferredBatch[0], deferredBatch[1])) {
        for (let i = 0; i < deferredBatch.length; i++) {
          this.enqueueBatchJob(deferredBatch[i])
        }
      }
    }

    for (const key in this.batches) {
      const batch = this.batches[key]
      delete this.batches[key]

      // only batch if necessary
      // this might occur, if there's e.g. only 1 findUnique in the batch
      if (batch.length === 1) {
        this.dispatchSingle(batch[0])
      } else {
        this.dispatchBatch(batch)
      }
    }
  }

  private dispatchTwoDeferredJobs(firstJob: Job, secondJob: Job): boolean {
    let firstHash: string | undefined
    let secondHash: string | undefined
    try {
      firstHash = this.options.batchBy(firstJob.request)
      secondHash = this.options.batchBy(secondJob.request)
    } catch {
      return false
    }

    if (!firstHash || firstHash !== secondHash) {
      return false
    }

    this.dispatchBatch([firstJob, secondJob])
    return true
  }

  private enqueueBatchJob(job: Job) {
    let hash: string | undefined
    try {
      hash = this.options.batchBy(job.request)
    } catch (error) {
      job.reject(error)
      return
    }

    if (!hash) {
      this.dispatchSingle(job)
      return
    }

    const batch = (this.batches[hash] ??= [])
    batch.push(job)
  }

  private dispatchBatch(batch: Job[]) {
    batch.sort((a, b) => this.options.batchOrder(a.request, b.request))
    this.options
      .batchLoader(batch.map((j) => j.request))
      .then((results) => {
        if (results instanceof Error) {
          for (let i = 0; i < batch.length; i++) {
            batch[i].reject(results)
          }
        } else {
          for (let i = 0; i < batch.length; i++) {
            const value = results[i]
            if (value instanceof Error) {
              batch[i].reject(value)
            } else {
              batch[i].resolve(value)
            }
          }
        }
      })
      .catch((e) => {
        for (let i = 0; i < batch.length; i++) {
          batch[i].reject(e)
        }
      })
  }

  private dispatchSingle(job: Job) {
    this.options
      .singleLoader(job.request)
      .then((result) => {
        if (result instanceof Error) {
          job.reject(result)
        } else {
          job.resolve(result)
        }
      })
      .catch((e) => {
        job.reject(e)
      })
  }

  get [Symbol.toStringTag]() {
    return 'DataLoader'
  }
}
