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

    this.loader(this.currentBatch.map(j => j.request))
      .then(results => {
        for (let i = 0; i < this.currentBatch!.length; i++) {
          const value = results[i]
          if (value instanceof Error) {
            this.currentBatch![i].reject(value)
          } else {
            this.currentBatch![i].resolve(value)
          }
        }

        this.currentBatch = undefined
      })
      .catch(e => {
        for (let i = 0; i < this.currentBatch!.length; i++) {
          this.currentBatch![i].reject(e)
        }
      })
  }
}
