import { fork } from 'child_process'
import { GeneratorOptions } from '@prisma/cli'
import fs from 'fs'
import { promisify } from 'util'

const writeFile = promisify(fs.writeFile)
const exists = promisify(fs.exists)

export type GeneratorWorkerJob = {
  packagePath: string
  config: GeneratorOptions
}

export async function generateInThread(options: GeneratorWorkerJob): Promise<string> {
  const workerPath = eval(`require('path').join(__dirname, 'GeneratorWorker.js')`) // ncc, leave us alone
  await ensureWorker(workerPath)
  return new Promise((resolve, reject) => {
    const child = fork(workerPath, [], {
      silent: true,
    })
    child.send(JSON.stringify(options))
    child.on('error', e => {
      reject(e)
    })
    child.on('message', msg => {
      const data = JSON.parse(msg)
      if (data.error) {
        reject(data.error)
      }
    })
    child.on('close', code => {
      if (code === 0) {
        resolve('')
      } else {
        reject()
      }
    })
  })
}

async function ensureWorker(workerPath: string) {
  if (await exists(workerPath)) {
    return
  }

  const code = `process.on('message', async message => {
  const job /*: GeneratorWorkerJob*/ = JSON.parse(message)
  try {
    const package = require(job.packagePath)
    const generatorFunction = package.generatorDefinition.generate
    await generatorFunction(job.config)
    process.exit(0)
  } catch (e) {
    process.send(JSON.stringify({ error: e.toString() }))
    process.exit(1)
  }
}`

  await writeFile(workerPath, code)
}
