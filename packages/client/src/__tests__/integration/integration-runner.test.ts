import * as child_process from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as util from 'util'

const exec = util.promisify(child_process.exec)
const wait = util.promisify(setTimeout)

const MAX = 2
const BACKOFF_MS = 100
const excluded = ['exhaustive-schema', 'exhaustive-schema-mongo', 'client-engine', 'ignore']

type TestType = 'happy' | 'errors'

async function spawnJest(options: {
  dir: string
  testType: TestType
}): Promise<child_process.PromiseWithChild<unknown>> {
  console.log(`Running: '${options.dir}'`)
  // Errors inside this child will propagate up
  const child = await exec(`jest ${options.testType}/${options.dir}`, {
    cwd: path.join(__dirname),
  })

  const { stderr, stdout } = child
  console.log(stderr)
  console.log(stdout)
  return child
}

async function* generator(dirs: string[], testType: TestType) {
  let __dirs__ = [...dirs]

  while (true) {
    const firstMax = __dirs__.slice(0, MAX)

    if (!firstMax.length) {
      break
    }

    __dirs__ = __dirs__.slice(MAX + 1)

    yield await Promise.all(firstMax.map((dir) => spawnJest({ dir, testType })))
  }
}

async function consume(gen: AsyncGenerator<unknown[], void, unknown>) {
  for await (const _ of gen) {
    await wait(BACKOFF_MS)
  }
}

describe('integration/integration-runner', () => {
  test.concurrent('happy', async () => {
    const dirs = (await fs.promises.readdir(path.join(__dirname, 'happy'))).filter((dir) => !excluded.includes(dir))
    const gen = generator(dirs, 'happy')
    await consume(gen)
  })

  test.concurrent('errors', async () => {
    const dirs = await fs.promises.readdir(path.join(__dirname, 'errors'))
    const gen = generator(dirs, 'errors')
    await consume(gen)
  })
})
