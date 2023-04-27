import childProcess from 'child_process'
import { once } from 'events'
import fs from 'fs/promises'
import { bold, green, red, white } from 'kleur/colors'
import { linearRegression } from 'simple-statistics'

import { buildMemoryTest } from './buildMemoryTest'
import { WARMUP_ITERATIONS } from './commonSettings'
import { dropMemoryTestDatabase, setupMemoryTestDatabase } from './database'
import { generateMemoryTestClient } from './generateMemoryTestClient'
import { MemoryTestDir } from './MemoryTestDir'

const GROWTH_RATE_THRESHOLD_IN_BYTES = 10

export type TestResult = {
  testDir: MemoryTestDir
  hasLeak: boolean
  heapUsageOverTime: number[]
}

/**
 * Runs a single memory test in a child process
 * See `createMemoryTest` source code for child process counterpart
 * source code.
 *
 * Does the following:
 * - bundles test file using esbuild. We don't want to use esbuild-register here
 * to avoid extra memory overhead
 * - generates client using provided schema and creates a database
 * - runs the test in a child process. During the run, child will periodically
 * write current heap usage into results file
 * - when child exits, reads heap usage over time. Using that information it can then make
 * a decision on whether or not leak is happening and create html report with a graph
 * (see `detectPossibleMemoryLeak` comments)
 * - if memory leak is happening, set process exit code to 1
 *
 * @param testDir
 */
export async function runMemoryTest(testDir: MemoryTestDir): Promise<TestResult> {
  console.log(`Running test ${bold(testDir.testName)}`)
  await fs.rm(testDir.generatedDir, { recursive: true, force: true })
  await buildMemoryTest(testDir)
  await setupMemoryTestDatabase(testDir)
  try {
    await generateMemoryTestClient(testDir)

    const heapUsageOverTime = await runTestProcess(testDir)

    const { hasLeak, growthRate } = detectPossibleMemoryLeak(heapUsageOverTime)

    if (hasLeak) {
      console.log(bold(red('Looks like test is leaking memory')))
      console.log('')
      console.log(`Leak rate: ${red(growthRate)} bytes / iteration`)

      process.exitCode = 1
    } else {
      console.log(white('No memory leak detected'))
      console.log(`Memory growth rate: ${green(growthRate)} bytes / iteration, which is below threshold`)
    }
    console.log('')
    return { testDir, hasLeak, heapUsageOverTime }
  } finally {
    await dropMemoryTestDatabase(testDir)
  }
}

/**
 * Runs test process, passing result file path as an argument and reads back
 * the results
 * @param testDir
 * @returns
 */
async function runTestProcess(testDir: MemoryTestDir) {
  const child = childProcess.spawn(
    'node',
    [
      // exposing GC and disabling a bunch
      // of caches to minimize their impact on memory
      '--expose-gc',
      '--no-compilation-cache',
      '--no-opt',
      testDir.compiledTestPath,
      testDir.resultsPath,
    ],
    {
      stdio: 'inherit',
    },
  )

  await once(child, 'exit')
  return readTestResults(testDir)
}

/**
 * After test is finished, reads its results and converts it to numeric
 * array
 *
 * @param testDir
 * @returns
 */
async function readTestResults(testDir: MemoryTestDir) {
  return (await fs.readFile(testDir.resultsPath, 'utf-8'))
    .split('\n')
    .slice(WARMUP_ITERATIONS) // do not take warmup iterations count into account
    .filter((line) => line !== '')
    .map((value) => parseFloat(value))
}

/**
 * Given heap usage over time data, determines memory
 * growth rate, and based on that, decides whether or not
 * to consider it a memory leak
 *
 * In order to determine growth rate, it first tries to fit the data
 * into the line. Why do we do that, as opposed to just computing average deltas?
 * It helps to filter out the outliers: node is a complicated things and occasionally,
 * memory usage data will have short spikes, which nevertheless will skew the average
 * too much and make it quite difficult to come up with reliable threshold. Fitting
 * data into the closest possible line helps to smooth the data and get reproducible
 * result from run to run.
 *
 * `linearRegression` function will return line equation, y = mx + b, where m is the
 * slope of the line of the line. In our case, m corresponds to the memory growth rate
 * of the test. If it gets over threshold we declare a memory leak and fail the test.
 *
 * @param heapUsageOverTime
 * @returns
 */
function detectPossibleMemoryLeak(heapUsageOverTime: number[]) {
  const trendLine = linearRegression(Array.from(heapUsageOverTime.entries()))

  return {
    hasLeak: trendLine.m > GROWTH_RATE_THRESHOLD_IN_BYTES,
    growthRate: trendLine.m,
  }
}
