#!/usr/bin/env node
// @ts-check

const { stdin } = process
const fs = require('fs')

// From https://github.com/sindresorhus/get-stdin/blob/main/index.js
async function getStdin() {
  let result = ''

  if (stdin.isTTY) {
    return result
  }

  stdin.setEncoding('utf8')

  for await (const chunk of stdin) {
    result += chunk
  }

  return result
}

async function main() {
  const jobsToRun = []
  const stdinData = await getStdin()
  console.debug('stdin:', stdinData)

  // If the stdin is empty, we run all jobs
  // It happens if the get-changed-files-action fails (e.g. if ran on a schedule)
  if (!stdinData) {
    console.log('Stdin is empty (expected some JSON as a string) - running all jobs as fallback.')
    jobsToRun.push('-all-')
  }

  /**
   * @type string[]
   **/
  const filesChanged = JSON.parse(stdinData)
  console.debug('filesChanged:', filesChanged)

  // If changes are located only in one of the paths below
  if (filesChanged.every((fileChanged) => fileChanged.startsWith('packages/cli/'))) {
    jobsToRun.push('-cli-')
  } else if (filesChanged.every((fileChanged) => fileChanged.startsWith('packages/client/'))) {
    jobsToRun.push('-client-')
    jobsToRun.push('-integration-tests-')
    jobsToRun.push('-cli-')
  } else if (filesChanged.every((fileChanged) => fileChanged.startsWith('packages/integration-tests/'))) {
    jobsToRun.push('-integration-tests-')
  } else if (filesChanged.every((fileChanged) => fileChanged.startsWith('packages/migrate/'))) {
    jobsToRun.push('-migrate-')
    jobsToRun.push('-cli-')
  } else {
    jobsToRun.push('-all-')
  }

  console.log('jobsToRun:', jobsToRun)
  if (typeof process.env.GITHUB_OUTPUT == 'string' && process.env.GITHUB_OUTPUT.length > 0) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `jobs=${jobsToRun.join()}\n`)
    console.debug('jobsToRun added to GITHUB_OUTPUT')
  }
}

main().then(function () {
  console.log('Done')
})
