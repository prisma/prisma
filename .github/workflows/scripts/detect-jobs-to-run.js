#!/usr/bin/env node
// @ts-check

const { stdin } = process

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
  const filesChanged = JSON.parse(stdinData)
  console.log('filesChanged:', filesChanged)

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
  console.log('::set-output name=jobs::' + jobsToRun.join())
}

main().then(function () {
  console.log('Done')
})
