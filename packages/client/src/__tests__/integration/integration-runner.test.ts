import * as child_process from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as util from 'util'

const exec = util.promisify(child_process.exec)
const wait = util.promisify(setTimeout)

const MAX = 2
const BACKOFF_MS = 100
const excluded = ['']

type TestType = 'happy' | 'errors'

type Log = {
  name: string
  stderr?: string
  stdout?: string
}

async function spawnJest(options: { dir: string; testType: TestType }): Promise<Log> {
  const name = `${options.testType}/${options.dir}`

  // Errors inside this child will propagate up
  const child = await exec(`jest  ${name} --config=${__dirname.replace(/\\\\/g, '/')}/jest.config.js --runInBand`, {
    cwd: process.cwd(),
  })

  const { stderr, stdout } = child
  const log: Log = {
    name,
    stderr,
    stdout,
  }

  return log
}

async function* generator(dirs: string[], testType: TestType): AsyncIterableIterator<Log[]> {
  let __dirs__ = [...dirs]

  while (true) {
    const firstMax = __dirs__.slice(0, MAX)

    if (!firstMax.length) {
      break
    }

    __dirs__ = __dirs__.slice(MAX + 1)

    const logs = await Promise.all(firstMax.map((dir) => spawnJest({ dir, testType })))

    yield logs
  }
}

describe('integration/integration-runner', () => {
  let logs: Log[] = []
  let timeout: NodeJS.Timeout

  async function consume(gen: AsyncIterableIterator<Log[]>) {
    for await (const l of gen) {
      logs = [...logs, ...l]
      await wait(BACKOFF_MS)
    }
  }

  beforeAll(() => {
    timeout = setInterval(() => {
      console.log(`integration/integration-runner still alive: ${logs.length} completed`)
    }, 5000)
  })

  afterAll(() => {
    clearTimeout(timeout)

    const log = logs
      .map((log) => `${log.name}${log.stderr && `\n${log.stderr}`}${log.stderr && `\n${log.stderr}`}`)
      .join('\n')
    console.log(log)
  })

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
