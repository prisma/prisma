import { parentPort, workerData } from 'worker_threads'

import { LibraryEngine } from '../library/LibraryEngine'

const engine = new LibraryEngine(workerData)

parentPort?.on('message', async (message) => {
  try {
    const data = await engine[message.action](...message.data)
    parentPort?.postMessage({ id: message.id, data: data })
  } catch (e) {
    e.constructorName = e.constructor.name
    const error = JSON.stringify(e, Object.getOwnPropertyNames(e))
    parentPort?.postMessage({ id: message.id, error: JSON.parse(error) })
  }
})
