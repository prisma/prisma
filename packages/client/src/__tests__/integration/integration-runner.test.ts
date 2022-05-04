import * as child_process from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as util from 'util'

const exec = util.promisify(child_process.exec)

const MAX = 2
const BACKOFF_MS = 100
const excluded = ['exhaustive-schema', 'exhaustive-schema-mongo', 'client-engine', 'ignore']

async function spawnJest(options: { dir: string }): Promise<child_process.PromiseWithChild<unknown>> {
  console.log(`Running: 'pnpm run test ${options.dir}'`)
  const child = await exec(`pnpm run test ${options.dir}`, { cwd: process.cwd() })
  return child
}

async function* generator(dirs: string[]) {
  let __dirs__ = [...dirs]

  while (true) {
    const firstMax = __dirs__.slice(0, MAX)

    if (!firstMax.length) {
      break
    }

    __dirs__ = __dirs__.slice(MAX + 1)

    yield await Promise.all(firstMax.map((dir) => spawnJest({ dir })))
  }
}

describe('integration/integration-runner', () => {
  test.concurrent('happy', async () => {
    const dirs = fs.readdirSync(path.join(__dirname, 'happy')).filter((dir) => !excluded.includes(dir))
    for await (const _ of generator(dirs)) {
      await util.promisify(setTimeout)(BACKOFF_MS)
    }
  })

  test.concurrent('errors', async () => {
    const dirs = fs.readdirSync(path.join(__dirname, 'errors'))
    for await (const _ of generator(dirs)) {
      await util.promisify(setTimeout)(BACKOFF_MS)
    }
  })
})
