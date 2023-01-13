import { arg } from '@prisma/internals'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { $ } from 'zx'

const args = arg(
  process.argv.slice(2),
  {
    '--verbose': Boolean,
    // also build cli and client packages
    '--build': Boolean,
  },
  true,
  true,
)

async function main() {
  if (args instanceof Error) {
    console.log(args.message)
    process.exit(1)
  }

  $.verbose = args['--verbose'] ?? false

  if ($.verbose === true) {
    await $`docker -v`
  }

  console.log('🎠 Preparing e2e tests')
  // we first get all the paths we are going to need to run e2e tests
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prisma-build'))
  const cliPkgPath = path.join(__dirname, '..', '..', '..', '..', 'cli')
  const clientPkgPath = path.join(__dirname, '..', '..', '..', '..', 'client')
  const clientRuntimeDtsPath = path.join(clientPkgPath, 'runtime', 'index.d.ts')
  const cliPkgJsonPath = path.join(cliPkgPath, 'package.json')
  const clientPkgJsonPath = path.join(clientPkgPath, 'package.json')
  const cliPkgJson = require(cliPkgJsonPath)
  const clientPkgJson = require(clientPkgJsonPath)

  // this process will need to modify some package.json, we save copies
  await $`cd ${tmpDir} && cp ${cliPkgJsonPath} cli.package.json`
  await $`cd ${tmpDir} && cp ${clientPkgJsonPath} client.package.json`
  await $`cd ${tmpDir} && cp ${clientRuntimeDtsPath} client.runtime.d.ts`

  // we provide a function that can revert modified package.json back
  const restoreOriginal = async () => {
    await $`cd ${tmpDir} && cp cli.package.json ${cliPkgJsonPath}`
    await $`cd ${tmpDir} && cp client.package.json ${clientPkgJsonPath}`
    await $`cd ${tmpDir} && cp client.runtime.d.ts ${clientRuntimeDtsPath}`
  }

  // if process is killed by hand, ensure that package.json is restored
  process.on('SIGINT', () => restoreOriginal().then(() => process.exit(0)))

  // use bundleDependencies to directly include deps like @prisma/engines
  cliPkgJson.bundleDependencies = Object.keys(cliPkgJson.dependencies)
  clientPkgJson.bundleDependencies = Object.keys(clientPkgJson.dependencies)

  // write the modified package.json to overwrite the original package.json
  await fs.writeFile(cliPkgJsonPath, JSON.stringify(cliPkgJson, null, 2))
  await fs.writeFile(clientPkgJsonPath, JSON.stringify(clientPkgJson, null, 2))
  // this is to avoid bundling types and locally link directly to the sources
  await fs.writeFile(clientRuntimeDtsPath, `export * from '/client/src/runtime/index'`)

  try {
    console.log('📦 Packing package tarballs')
    const skipBuild = args['--build'] ? 'false' : 'true'
    await $`cd ${clientPkgPath} && SKIP_BUILD=${skipBuild} pnpm pack --pack-destination ${__dirname}/../`
    await $`cd ${cliPkgPath} && SKIP_BUILD=${skipBuild} pnpm pack --pack-destination ${__dirname}/../`
  } catch (e) {
    console.log(e.message)
    console.log('🛑 Failed to pack one or more of the packages')
    console.log('💡 Make sure to run `watch`, `dev` or `build`')
  } finally {
    await restoreOriginal() // when done, we restore the original package.json
  }

  console.log('🐳 Starting tests in docker')
  // tarball was created, ready to send it to docker and begin e2e tests
  const testNames = args._.join(' ')
  await $`docker compose -f ${__dirname}/docker-compose.yml down`
  await $`docker compose -f ${__dirname}/docker-compose.yml build ${testNames}`
  await $`docker compose -f ${__dirname}/docker-compose.yml up ${testNames}`

  // let the tests run and gather a list of logs for containers that have failed
  const findErrors = await $`find "$(pwd)" -not -name .logs.0.txt -name .logs.*.txt`
  const errors = findErrors.stdout.split('\n').filter((v) => v.length > 0)
  if (errors.length > 0) {
    console.log(`🛑 ${errors.length} tests failed with`, errors)
  } else {
    console.log(`✅ All tests passed`)
  }
}

void main().catch((e) => {
  console.log(e)
  process.exit(1)
})
