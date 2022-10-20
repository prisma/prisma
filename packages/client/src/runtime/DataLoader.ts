interface Job {
  resolve: (data: any) => void
  reject: (data: any) => void
  request: any
}

export type DataLoaderOptions<T> = {
  singleLoader: (request: T) => Promise<any>
  batchLoader: (request: T[]) => Promise<any[]>
  batchBy: (request: T) => string | undefined
}

export class DataLoader<T = unknown> {
  batches: { [key: string]: Job[] }
  private tickActive = false
  constructor(private options: DataLoaderOptions<T>) {
    this.batches = {}
  }

  request(request: T): Promise<any> {
    const hash = this.options.batchBy(request)
    if (!hash) {
      return this.options.singleLoader(request)
    }
    if (!this.batches[hash]) {
      this.batches[hash] = []

      // make sure, that we only tick once at a time
      if (!this.tickActive) {
        this.tickActive = true
        process.nextTick(() => {
          this.dispatchBatches()
          this.tickActive = false
        })
      }
    }

    return new Promise((resolve, reject) => {
      this.batches[hash].push({
        request,
        resolve,
        reject,
      })
    })
  }

  private dispatchBatches() {
    for (const key in this.batches) {
      const batch = this.batches[key]
      delete this.batches[key]

      // only batch if necessary
      // this might occur, if there's e.g. only 1 findUnique in the batch
      if (batch.length === 1) {
        this.options
          .singleLoader(batch[0].request)
          .then((result) => {
            if (result instanceof Error) {
              batch[0].reject(result)
            } else {
              batch[0].resolve(result)
            }
          })
          .catch((e) => {
            batch[0].reject(e)
          })
      } else {
        this.options
          .batchLoader(batch.map((j) => j.request))
          .then((results) => {
            if (results instanceof Error) {
              for (let i = 0; i < batch.length; i++) {
                console.log('HMMM')
                batch[i].reject(results[i])
              }
            } else {
              for (let i = 0; i < batch.length; i++) {
                const value = results[i]
                if (value instanceof Error) {
                  console.log('LEL')
                  batch[i].reject(value)
                } else {
                  batch[i].resolve(value)
                }
              }
            }
          })
          .catch((e) => {
            console.log('LOLOL')
            for (let i = 0; i < batch.length; i++) {
              batch[i].reject(e)
            }
          })
      }
    }
  }

  get [Symbol.toStringTag]() {
    return 'DataLoader'
  }
}
