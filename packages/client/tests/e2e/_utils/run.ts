import { arg } from '@prisma/internals'
import fs from 'fs/promises'
import glob from 'globby'
import path from 'path'
import { $, ProcessOutput, sleep } from 'zx'

const monorepoRoot = path.resolve(__dirname, '..', '..', '..', '..', '..')

const args = arg(
  process.argv.slice(2),
  {
    // see which comman,ds are run and the outputs of the failures
    '--verbose': Boolean,
    // like run jest in band, useful for debugging and CI
    '--runInBand': Boolean,
    // do not fully build cli and client packages before packing
    '--skipBuild': Boolean,
    // do not fully pack cli and client packages before packing
    '--skipPack': Boolean,
    // a way to cleanup created files that also works on linux
    '--clean': Boolean,
  },
  true,
  true,
)

async function main() {
  if (args instanceof Error) {
    console.log(args.message)
    process.exit(1)
  }

  args['--runInBand'] = args['--runInBand'] ?? false
  args['--verbose'] = args['--verbose'] ?? false
  args['--skipBuild'] = args['--skipBuild'] ?? false
  args['--clean'] = args['--clean'] ?? false
  $.verbose = args['--verbose']

  if (args['--verbose'] === true) {
    await $`docker -v`
  }

  console.log('🧹 Cleaning up old files')
  if (args['--clean'] === true) {
    await $`docker compose -f ${__dirname}/docker-compose-clean.yml down --remove-orphans`
    await $`docker compose -f ${__dirname}/docker-compose-clean.yml up clean`
  } else {
    await $`docker compose -f ${__dirname}/docker-compose-clean.yml down --remove-orphans`
    await $`docker compose -f ${__dirname}/docker-compose-clean.yml up pre-clean`
  }

  console.log('🎠 Preparing e2e tests')

  // this process will need to modify some package.json, we save copies
  await $`pnpm -r exec cp package.json package.copy.json`

  // we provide a function that can revert modified package.json back
  const restoreOriginal = async () => {
    await $`pnpm -r exec cp package.copy.json package.json`
  }

  // if process is killed by hand, ensure that package.json is restored
  process.on('SIGINT', () => restoreOriginal().then(() => process.exit(0)))

  // we prepare to replace references to local packages with their tarballs names
  const allPackageFolderNames = await fs.readdir(path.join(monorepoRoot, 'packages'))
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

  try {
    if (args['--skipBuild'] !== true) {
      console.log('📦 Packing package tarballs')

      await $`pnpm -r build`
    }

    if (args['--skipPack'] !== true) {
      await $`pnpm -r exec pnpm pack --pack-destination /tmp/`
    }
  } catch (e) {
    console.log(e.message)
    console.log('🛑 Failed to pack one or more of the packages')
    console.log('💡 Make sure to run `watch`, `dev` or `build`')
    throw e
  } finally {
    await restoreOriginal() // when done, we restore the original package.json
  }

  console.log('🐳 Starting tests in docker')
  // tarball was created, ready to send it to docker and begin e2e tests
  const testStepFiles = await glob('../**/_steps.ts', { cwd: __dirname })
  let e2eTestNames = testStepFiles.map((p) => path.relative('..', path.dirname(p)))

  if (args._.length > 0) {
    e2eTestNames = e2eTestNames.filter((p) => args._.some((a) => p.includes(a)))
  }

  const dockerVolumes = [
    `/tmp/prisma-0.0.0.tgz:/tmp/prisma-0.0.0.tgz`, // hardcoded because folder doesn't match name
    ...allPackageFolderNames.map((p) => `/tmp/prisma-${p}-0.0.0.tgz:/tmp/prisma-${p}-0.0.0.tgz`),
    `${path.join(monorepoRoot, 'packages', 'engines')}:/engines`,
    `${path.join(monorepoRoot, 'packages', 'client')}:/client`,
    `${path.join(monorepoRoot, 'packages', 'client', 'tests', 'e2e')}:/e2e`,
    `${path.join(monorepoRoot, 'packages', 'client', 'tests', 'e2e', '.cache')}:/root/.cache`,
    `${(await $`pnpm store path`.quiet()).stdout.trim()}:/root/.local/share/pnpm/store/v3`,
  ]
  const dockerVolumeArgs = dockerVolumes.map((v) => `-v ${v}`).join(' ')

  await $`docker build -f ${__dirname}/standard.dockerfile -t prisma-e2e-test-runner .`

  const dockerJobs = e2eTestNames.map((path) => {
    return async () =>
      await $`docker run --rm ${dockerVolumeArgs.split(' ')} -e "NAME=${path}" prisma-e2e-test-runner`.nothrow()
  })

  let jobResults: (ProcessOutput & { name: string })[] = []
  if (args['--runInBand'] === true) {
    console.log('🏃 Running tests in band')
    for (const [i, job] of dockerJobs.entries()) {
      console.log(`💡 Running test ${i + 1}/${dockerJobs.length}`)
      jobResults.push(Object.assign(await job(), { name: e2eTestNames[i] }))
    }
  } else {
    console.log('🏃 Running tests in parallel')
    jobResults = (await Promise.all(dockerJobs.map((job) => job()))).map((result, i) => {
      return Object.assign(result, { name: e2eTestNames[i] })
    })
  }

  const failedJobResults = jobResults.filter((r) => r.exitCode !== 0)
  const passedJobResults = jobResults.filter((r) => r.exitCode === 0)

  if (args['--verbose'] === true) {
    for (const result of failedJobResults) {
      console.log(`🛑 ${result.name} failed with exit code`, result.exitCode)
      await $`cat ${path.resolve(__dirname, '..', result.name, 'LOGS.txt')}`
      await sleep(50) // give some time for the logs to be printed (CI issue)
    }
  }

  // let the tests run and gather a list of logs for containers that have failed
  if (failedJobResults.length > 0) {
    const failedJobLogPaths = failedJobResults.map((result) => path.resolve(__dirname, '..', result.name, 'LOGS.txt'))
    console.log(`✅ ${passedJobResults.length}/${jobResults.length} tests passed`)
    console.log(`🛑 ${failedJobResults.length}/${jobResults.length} tests failed`, failedJobLogPaths)

    throw new Error('Some tests exited with a non-zero exit code')
  } else {
    console.log(`✅ All ${passedJobResults.length}/${jobResults.length} tests passed`)
  }
}

void main().catch((e) => {
  console.log(e)
  process.exit(1)
})
