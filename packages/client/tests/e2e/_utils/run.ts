import { arg } from '@prisma/internals'
import fs from 'fs/promises'
import glob from 'globby'
import os from 'os'
import path from 'path'
import { $, ProcessOutput, ProcessPromise } from 'zx'

const args = arg(
  process.argv.slice(2),
  {
    // see which comman,ds are run and the outputs of the failures
    '--verbose': Boolean,
    // like run jest in band, useful for debugging and CI
    '--runInBand': Boolean,
    // do not fully build cli and client packages before packing
    '--skipBuild': Boolean,
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

  console.log(args['--runInBand'])

  if (args['--verbose'] === true) {
    await $`docker -v`
  }

  console.log('🧹 Cleaning up old files')
  if (args['--clean'] === true) {
    await $`docker compose -f ${__dirname}/docker-compose-clean.yml down --remove-orphans`
    await $`docker compose -f ${__dirname}/docker-compose-clean.yml up full-clean`
    return
  } else {
    await $`docker compose -f ${__dirname}/docker-compose-clean.yml down --remove-orphans`
    await $`docker compose -f ${__dirname}/docker-compose-clean.yml up pre-clean`
  }

  console.log('🎠 Preparing e2e tests')
  // we first get all the paths we are going to need to run e2e tests
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prisma-build'))
  const cliPkgPath = path.join(__dirname, '..', '..', '..', '..', 'cli')
  const clientPkgPath = path.join(__dirname, '..', '..', '..', '..', 'client')
  const cliPkgJsonPath = path.join(cliPkgPath, 'package.json')
  const clientPkgJsonPath = path.join(clientPkgPath, 'package.json')
  const cliPkgJson = require(cliPkgJsonPath)
  const clientPkgJson = require(clientPkgJsonPath)

  // this process will need to modify some package.json, we save copies
  await $`cd ${tmpDir} && cp ${cliPkgJsonPath} cli.package.json`
  await $`cd ${tmpDir} && cp ${clientPkgJsonPath} client.package.json`

  // we provide a function that can revert modified package.json back
  const restoreOriginal = async () => {
    await $`cd ${tmpDir} && cp cli.package.json ${cliPkgJsonPath}`
    await $`cd ${tmpDir} && cp client.package.json ${clientPkgJsonPath}`
  }

  // if process is killed by hand, ensure that package.json is restored
  process.on('SIGINT', () => restoreOriginal().then(() => process.exit(0)))

  // use bundleDependencies to directly include deps like @prisma/engines
  cliPkgJson.bundleDependencies = Object.keys(cliPkgJson.dependencies)
  clientPkgJson.bundleDependencies = Object.keys(clientPkgJson.dependencies)

  // write the modified package.json to overwrite the original package.json
  await fs.writeFile(cliPkgJsonPath, JSON.stringify(cliPkgJson, null, 2))
  await fs.writeFile(clientPkgJsonPath, JSON.stringify(clientPkgJson, null, 2))

  try {
    console.log('📦 Packing package tarballs')
    await $`cd ${clientPkgPath} && SKIP_BUILD=${args['--skipBuild']} pnpm pack --pack-destination ${__dirname}/../`
    await $`cd ${cliPkgPath} && SKIP_BUILD=${args['--skipBuild']} pnpm pack --pack-destination ${__dirname}/../`
  } catch (e) {
    console.log(e.message)
    console.log('🛑 Failed to pack one or more of the packages')
    console.log('💡 Make sure to run `watch`, `dev` or `build`')
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
    `${path.resolve(__dirname, '..')}/:/e2e`,
    `${path.resolve(__dirname, '..', '..', '..')}/:/client`,
    `${path.resolve(__dirname, '..', '..', '..', '..', '..')}/:/repo`,
    `${path.resolve(__dirname, '..', '.cache')}/:/root/.cache`,
    `${path.resolve(__dirname, '..', '.cache', 'pnpmcache')}/:/root/.local/share/pnpm/store/v3`,
    `${path.resolve(__dirname, '..', '.cache', 'npmcache')}/:/root/.npm`,
  ]
  const dockerVolumeArgs = dockerVolumes.map((v) => `-v ${v}`).join(' ')

  await $`docker build -f ${__dirname}/standard.dockerfile -t prisma-e2e-test-runner .`

  const dockerJobs = e2eTestNames.map((path) => {
    return $`docker run --rm ${dockerVolumeArgs.split(' ')} -e "NAME=${path}" prisma-e2e-test-runner`.nothrow()
  })

  let jobResults: (ProcessOutput & { name: string })[] = []
  if (args['--runInBand'] === true) {
    console.log('🏃 Running tests in band')
    for (const [i, job] of dockerJobs.entries()) {
      jobResults.push(Object.assign(await job, { name: e2eTestNames[i] }))
    }
  } else {
    console.log('🏃 Running tests in parallel')
    jobResults = (await Promise.all(dockerJobs)).map((result, i) => {
      return Object.assign(result, { name: e2eTestNames[i] })
    })
  }

  const failedJobResults = jobResults.filter((r) => r.exitCode !== 0)
  const passedJobResults = jobResults.filter((r) => r.exitCode === 0)

  if (args['--verbose'] === true) {
    for (const result of failedJobResults) {
      console.log(`🛑 ${result.name} failed with exit code`, result.exitCode)
      await $`cat ${path.resolve(__dirname, '..', result.name, 'LOGS.txt')}`
    }
  }

  // let the tests run and gather a list of logs for containers that have failed
  if (failedJobResults.length > 0) {
    const failedJobLogPaths = failedJobResults.map((result) => path.resolve(__dirname, '..', result.name, 'LOGS.txt'))
    console.log(`✅ ${passedJobResults.length}/${jobResults.length} tests passed`)
    console.log(`🛑 ${failedJobResults.length}/${jobResults.length} tests failed`, failedJobLogPaths)

    process.exit(1)
  } else {
    console.log(`✅ All ${passedJobResults.length}/${jobResults.length} tests passed`)
  }
}

void main().catch((e) => {
  console.log(e)
  process.exit(1)
})
