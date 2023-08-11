import fs from 'fs'
import path from 'path'

import { WARMUP_ITERATIONS } from './commonSettings'

declare function gc(): void

type PrismaModule = {
  PrismaClient: {
    new (...opts: any[]): any
  }
  Prisma: any
}

type ScenarioOptions<ModuleT extends PrismaModule, PrepareResult> = {
  warmupIterations?: number
  iterations?: number
  prepare?: (module: ModuleT) => PrepareResult | Promise<PrepareResult>
  run: (params: PrepareResult) => Promise<void>
  cleanup?: (params: PrepareResult) => Promise<void>
}

/**
 * Creates and runs child process of the memory test
 *
 * Expected to run with `--expose-gc` and results file as a
 * first command argument. The process is launched by
 * `runMemoryTest`.
 *
 *
 * It executes provided callback `iterations` + WARMUP_ITERATIONS iterations number of times,
 * with the assumption that parent process will ignore warmup iterations.
 * After each iteration, forces garbage collection and records current heap memory
 * usage into results file.
 *
 * We record it into the file as opposed to storing results in memory to
 * avoid skewing the measurements too much
 *
 * For results processing, see `runMemoryTest`
 *
 * @param callback
 * @param options
 */
export function createMemoryTest<ModuleT extends PrismaModule, PrepareResult = void>({
  iterations = 1000,
  prepare,
  run,
  cleanup,
}: ScenarioOptions<ModuleT, PrepareResult>) {
  void (async () => {
    const resultFile = process.argv[2]
    const dir = path.dirname(require.main!.filename)
    const prismaModule = require(path.join(dir, 'node_modules', '@prisma', 'client'))
    const runParams = (await prepare?.(prismaModule)) as PrepareResult
    const totalIterations = iterations + WARMUP_ITERATIONS

    const resultStream = fs.createWriteStream(resultFile)

    for (let i = 0; i < totalIterations; i++) {
      await run(runParams)
      gc()

      await new Promise((resolve) => resultStream.write(process.memoryUsage().heapUsed + '\n', resolve))
    }

    await cleanup?.(runParams)

    resultStream.close()
  })()
}
