interface Job {
  resolve: (data: any) => void
  reject: (data: any) => void
  request: any
}

export class Dataloader {
  currentBatch?: Job[]
  constructor(private loader: (data: any[]) => Promise<any[]>) {}
  request(request: any): Promise<any> {
    if (!this.currentBatch) {
      this.currentBatch = []
      process.nextTick(() => {
        this.dispatchBatch()
      })
    }

    return new Promise((resolve, reject) => {
      this.currentBatch!.push({
        request,
        resolve,
        reject,
      })
    })
  }

  private dispatchBatch() {
    if (!this.currentBatch) {
      throw new Error(`Can't dispatch without existing batch`)
    }

    const batch = this.currentBatch
    this.currentBatch = undefined

    this.loader(batch.map(j => j.request))
      .then(results => {
        if (results instanceof Error) {
          for (let i = 0; i < batch!.length; i++) {
            batch![i].reject(results)
          }
        } else {
          for (let i = 0; i < batch!.length; i++) {
            const value = results[i]
            if (value instanceof Error) {
              batch![i].reject(value)
            } else {
              batch![i].resolve(value)
            }
          }
        }
      })
      .catch(e => {
        for (let i = 0; i < batch!.length; i++) {
          batch![i].reject(e)
        }
      })
  }
}
