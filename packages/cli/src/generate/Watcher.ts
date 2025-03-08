import chokidar, { type FSWatcher } from 'chokidar'

type Resolve<T> = (value: T) => void

class EventQueue<T> {
  private _queue: T[] = []
  private _deferred: Resolve<T> | undefined

  push(value: T) {
    // if we are already waiting for next even, resolve next promise
    if (this._deferred) {
      this._deferred(value)
      this._deferred = undefined
    } else {
      this._queue.push(value)
    }
  }

  nextEvent(): Promise<T> {
    const event = this._queue.shift()
    if (event) {
      return Promise.resolve(event)
    }

    return new Promise((resolve) => {
      this._deferred = resolve
    })
  }
}

export class Watcher {
  private watcher: FSWatcher
  private changeQueue = new EventQueue<string>()
  constructor(rootDir: string) {
    this.watcher = chokidar.watch(rootDir, {
      ignoreInitial: true,
      followSymlinks: true,
    })

    this.watcher.on('all', (_e, path) => {
      this.changeQueue.push(path)
    })
  }

  add(watchPath: string) {
    this.watcher.add(watchPath)
  }

  async *[Symbol.asyncIterator]() {
    while (true) {
      const event = await this.changeQueue.nextEvent()
      yield event
    }
  }

  async stop() {
    await this.watcher.close()
  }
}
