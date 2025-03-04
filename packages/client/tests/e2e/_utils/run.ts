import { finished } from 'node:stream/promises'

import { arg } from '@prisma/internals'
import { createReadStream, existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import glob from 'globby'
import path from 'node:path'
import { $, type ProcessOutput, sleep } from 'zx'

const monorepoRoot = path.resolve(__dirname, '..', '..', '..', '..', '..')
const e2eRoot = path.join(monorepoRoot, 'packages', 'client', 'tests', 'e2e')

const args = arg(
  process.argv.slice(2),
  {
    // see which commands are run and the outputs of the failures
    '--verbose': Boolean,
    // like run jest in band, useful for debugging and CI
    '--runInBand': Boolean,
    '--run-in-band': '--runInBand',
    // do not fully pack cli and client packages before packing
    '--skipPack': Boolean,
    '--skip-pack': '--skipPack',
    // a way to cleanup created files that also works on linux
    '--clean': Boolean,
    // number of workers to use for parallel tests
    '--maxWorkers': Number,
    '--max-workers': '--maxWorkers',
  },
  true,
  true,
)

async function main() {
  if (args instanceof Error) {
    console.log(args.message)
    process.exit(1)
  }

  args['--maxWorkers'] = args['--maxWorkers'] ?? (process.env.CI === 'true' ? 3 : Number.POSITIVE_INFINITY)
  args['--runInBand'] = args['--runInBand'] ?? false
  args['--skipPack'] = args['--skipPack'] ?? false
  args['--verbose'] = args['--verbose'] ?? false
  args['--clean'] = args['--clean'] ?? false
  $.verbose = args['--verbose']

  if (args['--verbose'] === true) {
    await $`docker -v`
  }

  console.log('🧹 Cleaning up old files')
  if (args['--clean'] === true) {
    await $`docker compose -f ${__dirname}/docker-compose-clean.yml down --remove-orphans`
    await $`docker compose -f ${__dirname}/docker-compose-clean.yml up clean`
  }

  console.log('🎠 Preparing e2e tests')

  let allPackageFolderNames = await fs.readdir(path.join(monorepoRoot, 'packages'))
  allPackageFolderNames = allPackageFolderNames.filter((p) => !p.includes('DS_Store'))

  if (args['--skipPack'] === false) {
    // this process will need to modify some package.json, we save copies
    await $`pnpm -r exec cp package.json package.copy.json`

    // we prepare to replace references to local packages with their tarballs names
    const localPackageNames = [...allPackageFolderNames.map((p) => `@prisma/${p}`), 'prisma']
    const allPackageFolders = allPackageFolderNames.map((p) => path.join(monorepoRoot, 'packages', p))
    const allPkgJsonPaths = allPackageFolders.map((p) => path.join(p, 'package.json'))
    const allPkgJson = allPkgJsonPaths.map((p) => require(p))

    // replace references to unbundled local packages with built and packaged tarballs
    for (let i = 0; i < allPkgJson.length; i++) {
      for (const key of Object.keys(allPkgJson[i].dependencies ?? {})) {
        if (localPackageNames.includes(key)) {
          allPkgJson[i].dependencies[key] = `/tmp/${key.replace('@prisma/', 'prisma-')}-0.0.0.tgz`
        }
      }

      await fs.writeFile(allPkgJsonPaths[i], JSON.stringify(allPkgJson[i], null, 2))
    }

    await $`pnpm -r --parallel exec pnpm pack --pack-destination /tmp/`
    await restoreOriginalState()
  }

  console.log('🐳 Starting tests in docker')
  // tarball was created, ready to send it to docker and begin e2e tests
  const testStepFiles = await glob('../**/_steps.ts', { cwd: __dirname })
  let e2eTestNames = testStepFiles.map((p) => path.relative('..', path.dirname(p)))

  if (args._.length > 0) {
    e2eTestNames = e2eTestNames.filter((p) => args._.some((a) => p.includes(a)))
  }

  const dockerVolumes = [
    '/tmp/prisma-0.0.0.tgz:/tmp/prisma-0.0.0.tgz', // hardcoded because folder doesn't match name
    ...allPackageFolderNames.map((p) => `/tmp/prisma-${p}-0.0.0.tgz:/tmp/prisma-${p}-0.0.0.tgz`),
    `${path.join(monorepoRoot, 'packages', 'engines')}:/engines`,
    `${path.join(monorepoRoot, 'packages', 'client')}:/client`,
    `${e2eRoot}:/e2e`,
    `${path.join(e2eRoot, '.cache')}:/root/.cache`,
    `${(await $`pnpm store path`.quiet()).stdout.trim()}:/root/.local/share/pnpm/store/v3`,
  ]
  const dockerVolumeArgs = dockerVolumes.flatMap((v) => ['-v', v])

  await $`docker compose -f ${__dirname}/docker-compose.yaml build test-e2e`

  const dockerJobs = e2eTestNames.map((testPath) => {
    const composeFileArgs = ['-f', `${__dirname}/docker-compose.yaml`]
    const localComposePath = path.join(e2eRoot, testPath, 'docker-compose.yaml')
    if (existsSync(localComposePath)) {
      composeFileArgs.push('-f', localComposePath)
    }

    const projectName = testPath.toLocaleLowerCase().replace(/[^0-9a-z_-]/g, '-')
    const networkName = `${projectName}_default`
    return async () => {
      const result =
        await $`docker compose ${composeFileArgs} -p ${projectName} run --rm ${dockerVolumeArgs} -e "NAME=${testPath}" test-e2e`.nothrow()

      await $`docker compose ${composeFileArgs} -p ${projectName} logs > ${path.join(
        e2eRoot,
        testPath,
        'LOGS.docker.txt',
      )}`
      await $`docker compose ${composeFileArgs} -p ${projectName} stop`
      await $`docker compose ${composeFileArgs} -p ${projectName} rm -f`
      await $`docker network rm -f ${networkName}`
      return result
    }
  })

  const jobResults: (ProcessOutput & { name: string })[] = []
  if (args['--runInBand'] === true) {
    console.log('🏃 Running tests in band')
    for (const [i, job] of dockerJobs.entries()) {
      console.log(`💡 Running test ${i + 1}/${dockerJobs.length}`)
      jobResults.push(Object.assign(await job(), { name: e2eTestNames[i] }))
    }
  } else {
    console.log('🏃 Running tests in parallel')

    const pendingJobResults = [] as Promise<void>[]
    let availableWorkers = args['--maxWorkers']
    for (const [i, job] of dockerJobs.entries()) {
      while (availableWorkers === 0) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      --availableWorkers // borrow worker
      const pendingJob = (async () => {
        console.log(`💡 Running test ${i + 1}/${dockerJobs.length}`)
        jobResults.push(Object.assign(await job(), { name: e2eTestNames[i] }))
        ++availableWorkers // return worker
      })()

      pendingJobResults.push(pendingJob)
    }

    await Promise.allSettled(pendingJobResults)
  }

  const failedJobResults = jobResults.filter((r) => r.exitCode !== 0)
  const passedJobResults = jobResults.filter((r) => r.exitCode === 0)

  if (args['--verbose'] === true) {
    for (const result of failedJobResults) {
      console.log('-----------------------------------------------------------------------')
      console.log(`🛑🛑🛑 Test "${result.name}" failed with exit code ${result.exitCode} 🛑🛑🛑`)
      console.log('\t\t⬇️ Container Log output below ⬇️\n\n')
      console.log('-----------------------------------------------------------------------')

      const logsPath = path.resolve(__dirname, '..', result.name, 'LOGS.txt')
      const dockerLogsPath = path.resolve(__dirname, '..', result.name, 'LOGS.docker.txt')

      if (await isFile(logsPath)) {
        await printFile(logsPath)
      } else if (await isFile(dockerLogsPath)) {
        await printFile(dockerLogsPath)
      }
      await sleep(50) // give some time for the logs to be printed (CI issue)

      console.log('-----------------------------------------------------------------------')
      console.log(`🛑 ⬆️ Container Log output of test failure "${result.name}" above ⬆️ 🛑`)
      console.log('-----------------------------------------------------------------------')
    }
  }

  // let the tests run and gather a list of logs for containers that have failed
  if (failedJobResults.length > 0) {
    const failedJobLogPaths = failedJobResults.map((result) => path.resolve(__dirname, '..', result.name, 'LOGS.txt'))
    console.log('-----------------------------------------------------------------------')
    console.log(`✅ ${passedJobResults.length}/${jobResults.length} tests passed`)
    console.log(`🛑 ${failedJobResults.length}/${jobResults.length} tests failed`, failedJobLogPaths)

    throw new Error('Some tests exited with a non-zero exit code')
  }
    console.log('-----------------------------------------------------------------------')
    console.log(`✅ All ${passedJobResults.length}/${jobResults.length} tests passed`)
}

async function restoreOriginalState() {
  if (args['--skipPack'] === false) {
    await $`pnpm -r exec cp package.copy.json package.json`
  }
}

async function printFile(filePath: string) {
  try {
    const fileStream = createReadStream(filePath)
    fileStream.pipe(process.stdout, { end: false })
    await finished(fileStream)
  } catch (err) {
    console.error(`Error trying to print log file "${filePath}":`, err)
  }
}

async function isFile(filePath: string) {
  try {
    const stat = await fs.stat(filePath)
    return stat.isFile()
  } catch (e) {
    if (e.code === 'ENOENT') {
      return false
    }
    throw e
  }
}

process.on('SIGINT', async () => {
  await restoreOriginalState()
  process.exit(0)
})

void main().catch((e) => {
  console.log(e)
  void restoreOriginalState()
  process.exit(1)
})
