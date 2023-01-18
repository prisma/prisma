import chalk from 'chalk'
import { existsSync } from 'fs'
import fs from 'fs/promises'
import path from 'path'

import { setupQueryEngine } from '../../_utils/setupQueryEngine'
import { generateMemoryUsageReport } from './generateMemoryUsageReport'
import { MemoryTestDir } from './MemoryTestDir'
import { runMemoryTest, TestResult } from './runMemoryTest'

/**
 * Runs all defined memory tests
 * If filter is set, runs only those tests, matching the filter
 * If no tests match the filter, exits with an error
 *
 * @param filter
 * @returns
 */
export async function runAllMemoryTests(filter?: string) {
  const testsDir = path.resolve(__dirname, '..')
  const dirContents = await fs.readdir(testsDir)
  const allTests = dirContents.filter((fileName) => {
    if (fileName[0] === '.' || fileName[0] === '_') {
      return false
    }
    if (!existsSync(path.join(testsDir, fileName, 'test.ts'))) {
      return false
    }
    return !filter || fileName.includes(filter)
  })

  if (allTests.length === 0) {
    console.error(`Error: no tests matching ${chalk.bold(filter)} found`)
    process.exitCode = 1
    return
  }

  await setupQueryEngine()

  const results = [] as TestResult[]
  for (const testDirName of allTests) {
    const result = await runMemoryTest(new MemoryTestDir(path.join(testsDir, testDirName)))
    results.push(result)
  }

  const reportPath = path.resolve(__dirname, '..', 'memory-report.html')
  await generateMemoryUsageReport(reportPath, results)

  console.log(`See report at: ${chalk.white.bold(reportPath)}`)
}
