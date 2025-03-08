import fs from 'node:fs'

/**
 * This script is used to check the test failures during the development of the client engine against known failures.
 * We don't want to have our CI red while we build out the functionality of the client engine but still get feedback if we break any of the already passing tests.
 *
 * This script can be run in 2 modes and must be run AFTER running the jest tests:
 * - Record mode: `tsx check-known-failures.ts --record <suffix>` => Accepts all failures of the last test run as the known list of failures.
 * - Check mode: `tsx check-known-failures.ts <suffix>` => Checks if any new test failed that was not in the known list of failures.
 *
 * The `suffix` value is used to differentiate the known failures list for different matrix constellations e.g. different driver adapters.
 *
 * It expects the jest results file in `./tests/functional/results.json` to be present from the previous jest run.
 * To achieve this the jest test must be run with `--json --outputFile=./tests/functional/results.json` flag.
 */

const JEST_RESULTS_FILE_LOCATION = './tests/functional/results.json'

function getFailedTestNames(): string[] {
  if (!fs.existsSync(JEST_RESULTS_FILE_LOCATION)) {
    throw Error(
      `❌ Jest results file not found at ${JEST_RESULTS_FILE_LOCATION}. Please run the jest tests with "--json --outputFile=./tests/functional/results.json" flag first!`,
    )
  }

  const testResults = JSON.parse(fs.readFileSync(JEST_RESULTS_FILE_LOCATION, 'utf-8'))

  return testResults.testResults
    .filter((test) => test.status === 'failed')
    .reduce(
      (acc, test) =>
        acc.concat(
          test.assertionResults
            .filter((assertion) => assertion.status === 'failed')
            .map((assertion) => assertion.fullName.replaceAll(/seed=-?\d+/g, 'seed=XXXX')),
        ),
      [] as string[],
    )
    .sort()
}

function run() {
  const failedTestNames = getFailedTestNames()

  if (failedTestNames.length === 0) {
    console.log('🎉 No test failures! 🎉')
    console.log('=> You might be able to drop this check for known failures now? 😉')
    return
  }

  const isRecordMode = process.argv.slice(2)[0] === '--record'
  // Suffix to differentiate failure list for different matrix constellations e.g. different driver adapters
  const suffix = process.argv.slice(2)[isRecordMode ? 1 : 0]
  if (!suffix) throw 'Please specify a suffix based on the test matrix e.g. the driver adapter name!'

  const KNOWN_FAILURES_FILE_LOCATION = `./tests/functional/client-engine-known-failures-${suffix}.txt`

  if (isRecordMode) {
    fs.writeFileSync(KNOWN_FAILURES_FILE_LOCATION, `${failedTestNames.join('\n')}\n`)

    console.error('💾 Recorded test failures as known')
  } else {
    const knownFailures = new Set(fs.readFileSync(KNOWN_FAILURES_FILE_LOCATION, 'utf-8').split('\n'))

    const unexpectedFailures = failedTestNames.filter((testName) => !knownFailures.has(testName))
    if (unexpectedFailures.length > 0) {
      console.error('🛑 Unexpected failures found: 🛑')
      console.error(unexpectedFailures.join('\n'))
      process.exit(1)
    } else {
      console.log('Following tests failed as expected:')
      console.error(failedTestNames.join('\n'))
      console.log('☑️ All failures are expected.')
    }
  }
}

run()
