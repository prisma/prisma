import { arg } from '@prisma/internals'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { $ } from 'zx'

const args = arg(
  process.argv.slice(2),
  {
    '--verbose': Boolean,
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

  args['--verbose'] = args['--verbose'] ?? false
  args['--skipBuild'] = args['--skipBuild'] ?? false
  args['--clean'] = args['--clean'] ?? false
  $.verbose = args['--verbose']

  if (args['--verbose'] === true) {
    await $`docker -v`
  }

  console.log('🧹 Cleaning up old files')
  await $`docker compose -f ${__dirname}/docker-compose-clean.yml down --remove-orphans`
  await $`docker compose -f ${__dirname}/docker-compose-clean.yml build`
  await $`docker compose -f ${__dirname}/docker-compose-clean.yml up`

  if (args['--clean'] === true) return

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
  const testNames = args._.join(' ').replace(/\//g, '-')
  await $`docker compose -f ${__dirname}/docker-compose.yml down --remove-orphans`
  await $`docker compose -f ${__dirname}/docker-compose.yml build ${testNames}`
  await $`docker compose -f ${__dirname}/docker-compose.yml up ${testNames}`

  // let the tests run and gather a list of logs for containers that have failed
  const findErrors = await $`find "$(pwd)" -not -name "LOGS.0.txt" -name "LOGS.*.txt"`
  const findSuccess = await $`find "$(pwd)" -name "LOGS.0.txt"`
  const errors = findErrors.stdout.split('\n').filter((v) => v.length > 0)
  const success = findSuccess.stdout.split('\n').filter((v) => v.length > 0)
  if (errors.length > 0) {
    if (args['--verbose'] === true) {
      for (const error of errors) {
        console.log(`📄 ${error}`)
        await $`cat ${error}`
      }
    }

    console.log(`🛑 ${errors.length} tests failed with`, errors)

    process.exit(1)
  } else {
    console.log(`✅ All ${success.length} tests passed`)
  }
}

void main().catch((e) => {
  console.log(e)
  process.exit(1)
})
