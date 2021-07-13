/* eslint-disable no-async-promise-executor */
import Crypto from 'crypto'

type Task<R> = () => R

/**
 * Generate a random taskId
 * @returns taskId
 */
function getTaskId() {
  return Crypto.randomBytes(10).toString('hex')
}

/**
 * Execute [[Task]]s one after another
 */
class Scheduler {
  private _results: { [id: string]: Promise<unknown> }

  constructor() {
    this._results = {}
  }

  /**
   * Queue a [[Task]] to be executed
   * @param task to execute
   * @returns taskId
   */
  queue(task: Task<unknown>): string {
    const taskId = getTaskId() // unique task id for management

    // this promise ensures that thing execute one after another
    this._results[taskId] = (async () => {
      const taskIds = Object.keys(this._results)

      try {
        if (taskIds.length > 0) {
          // if we have a promise before us, we make sure to wait
          // this way, we are effectively pipelining our execution
          await this._results[taskIds[taskIds.length - 1]]
        }
      } catch {
        // we don't want to throw prev error onto the next promise
      }

      return task() // but we do want our current promise to throw
    })()

    return taskId
  }

  /**
   * Wait for a [[Task]] to execute
   * @param taskId taskId from [[queue]]
   * @returns task return value
   */
  wait(taskId: string): Promise<unknown> {
    const result = this._results[taskId]

    // a result can only be retrieved once
    delete this._results[taskId]

    return result
  }

  /**
   * Queue and wait for a [[Task]]
   * @param task to execute
   * @returns task return value
   */
  async exec<R>(task: Task<R>): Promise<R> {
    const taskId = this.queue(task)

    return this.wait(taskId) as Promise<R>
  }
}

export { Scheduler }
