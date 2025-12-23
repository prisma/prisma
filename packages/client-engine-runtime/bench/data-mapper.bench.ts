import { withCodSpeed } from '@codspeed/benchmark.js-plugin'
import Benchmark from 'benchmark'

import { applyDataMap } from '../src/interpreter/data-mapper'
import { runSuite, syncBench } from './bench-utils'
import { generateNestedData, generateUserRows, USER_STRUCTURE, USER_WITH_POSTS_STRUCTURE } from './mock-data'

async function runBenchmarks(): Promise<void> {
  const smallUserData = generateUserRows(10)
  const mediumUserData = generateUserRows(50)
  const largeUserData = generateUserRows(100)
  const nestedDataSmall = generateNestedData(5, 3)
  const nestedDataMedium = generateNestedData(10, 5)
  const nestedDataLarge = generateNestedData(20, 10)

  const suite = withCodSpeed(new Benchmark.Suite('data-mapper'))

  suite.add(
    'dataMapper: 10 rows',
    syncBench(() => {
      applyDataMap(smallUserData, USER_STRUCTURE, {})
    }),
  )

  suite.add(
    'dataMapper: 50 rows',
    syncBench(() => {
      applyDataMap(mediumUserData, USER_STRUCTURE, {})
    }),
  )

  suite.add(
    'dataMapper: 100 rows',
    syncBench(() => {
      applyDataMap(largeUserData, USER_STRUCTURE, {})
    }),
  )

  suite.add(
    'dataMapper: nested 5 users x 3 posts',
    syncBench(() => {
      applyDataMap(nestedDataSmall, USER_WITH_POSTS_STRUCTURE, {})
    }),
  )

  suite.add(
    'dataMapper: nested 10 users x 5 posts',
    syncBench(() => {
      applyDataMap(nestedDataMedium, USER_WITH_POSTS_STRUCTURE, {})
    }),
  )

  suite.add(
    'dataMapper: nested 20 users x 10 posts',
    syncBench(() => {
      applyDataMap(nestedDataLarge, USER_WITH_POSTS_STRUCTURE, {})
    }),
  )

  await runSuite(suite)
}

void runBenchmarks()
