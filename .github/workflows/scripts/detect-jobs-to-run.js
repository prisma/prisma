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
  const stdinData = await getStdin()
  console.log('stdin:', stdinData)

  /**
   * @type string[]
   **/
  if(stdinData !== "") {
    const filesChanged = JSON.parse(stdinData)
    console.log('filesChanged:', filesChanged)
  } else {
    const filesChanged = []
    console.log('no filesChanged')
  }
  

  const jobsToRun = []

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
