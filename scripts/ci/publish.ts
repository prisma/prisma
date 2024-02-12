import { dependencies as dependenciesPrismaEnginesPkg } from '@prisma/engines/package.json'
import slugify from '@sindresorhus/slugify'
import { IncomingWebhook } from '@slack/webhook'
import arg from 'arg'
import topo from 'batching-toposort'
import execa from 'execa'
import fs from 'fs'
import globby from 'globby'
import { blue, bold, cyan, dim, magenta, red, underline } from 'kleur/colors'
import pRetry from 'p-retry'
import path from 'path'
import redis from 'redis'
import semver from 'semver'
import { promisify } from 'util'

const onlyPackages = process.env.ONLY_PACKAGES ? process.env.ONLY_PACKAGES.split(',') : null
const skipPackages = process.env.SKIP_PACKAGES ? process.env.SKIP_PACKAGES.split(',') : null

async function getLatestCommitHash(dir: string): Promise<string> {
  if (process.env.GITHUB_CONTEXT) {
    const context = JSON.parse(process.env.GITHUB_CONTEXT)
    return context.sha
  }

  const result = await runResult(dir, 'git log --pretty=format:"%ad %H %P" --date=iso-strict -n 1')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [date, hash] = result.split(' ')
  return hash
}

/**
 * Runs a command and returns the resulting stdout in a Promise.
 * @param cwd cwd for running the command
 * @param cmd command to run
 */
async function runResult(cwd: string, cmd: string): Promise<string> {
  try {
    const result = await execa.command(cmd, {
      cwd,
      stdio: 'pipe',
      shell: true,
    })
    return result.stdout
  } catch (_e) {
    const e = _e as execa.ExecaError
    throw new Error(red(`Error running ${bold(cmd)} in ${underline(cwd)}:`) + (e.stderr || e.stack || e.message))
  }
}

/**
 * Runs a command and pipes the stdout & stderr to the current process.
 * @param cwd cwd for running the command
 * @param cmd command to run
 */
async function run(cwd: string, cmd: string, dry = false, hidden = false): Promise<void> {
  const args = [underline('./' + cwd).padEnd(20), bold(cmd)]
  if (dry) {
    args.push(dim('(dry)'))
  }
  if (!hidden) {
    console.log(...args)
  }
  if (dry) {
    return
  }

  try {
    await execa.command(cmd, {
      cwd,
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
        PRISMA_SKIP_POSTINSTALL_GENERATE: 'true',
      },
    })
  } catch (_e) {
    const e = _e as execa.ExecaError
    throw new Error(red(`Error running ${bold(cmd)} in ${underline(cwd)}:`) + (e.stderr || e.stack || e.message))
  }
}

type RawPackage = {
  path: string
  packageJson: any
}
type RawPackages = { [packageName: string]: RawPackage }

export async function getPackages(): Promise<RawPackages> {
  const packagePaths = await globby(['packages/*/package.json'], {
    ignore: ['**/node_modules/**', '**/examples/**', '**/fixtures/**'],
  })
  const packages = await Promise.all(
    packagePaths.map(async (p) => ({
      path: p,
      packageJson: JSON.parse(await fs.promises.readFile(p, 'utf-8')),
    })),
  )

  return packages.reduce<RawPackages>((acc, p) => {
    if (p.packageJson.name) {
      acc[p.packageJson.name] = p
    }
    return acc
  }, {})
}

interface Package {
  private?: boolean
  name: string
  path: string
  version: string
  usedBy: string[]
  usedByDev: string[]
  uses: string[]
  usesDev: string[]
  packageJson: any
}

type Packages = { [packageName: string]: Package }

export function getPackageDependencies(packages: RawPackages): Packages {
  const packageCache = Object.entries(packages).reduce<Packages>((acc, [name, pkg]) => {
    const usesDev = getPrismaDependencies(pkg.packageJson.devDependencies)
    acc[name] = {
      private: pkg.packageJson.private,
      version: pkg.packageJson.version,
      name,
      path: pkg.path,
      usedBy: [],
      usedByDev: [],
      uses: getPrismaDependencies(pkg.packageJson.dependencies),
      usesDev,
      packageJson: pkg.packageJson,
    }
    return acc
  }, {})

  for (const pkg of Object.values(packageCache)) {
    for (const dependency of pkg.uses) {
      if (packageCache[dependency]) {
        packageCache[dependency].usedBy.push(pkg.name)
      } else {
        console.info(`Skipping ${dependency} as it's not in this workspace`)
      }
    }
    for (const devDependency of pkg.usesDev) {
      if (packageCache[devDependency]) {
        packageCache[devDependency].usedByDev.push(pkg.name)
      } else {
        console.info(`Skipping ${devDependency} as it's not in this workspace`)
      }
    }
  }

  return packageCache
}

function getPrismaDependencies(dependencies?: { [name: string]: string }): string[] {
  if (!dependencies) {
    return []
  }
  return Object.keys(dependencies).filter((d) => d.startsWith('@prisma') && !d.startsWith('@prisma/studio'))
}

function getCircularDependencies(packages: Packages): string[][] {
  const circularDeps = [] as string[][]
  for (const pkg of Object.values(packages)) {
    const uses = [...pkg.uses, ...pkg.usesDev]
    const usedBy = [...pkg.usedBy, ...pkg.usedByDev]
    const circles = intersection(uses, usedBy)
    if (circles.length > 0) {
      circularDeps.push(circles)
    }
  }

  return circularDeps
}

export function getPublishOrder(packages: Packages): string[][] {
  const dag: { [pkg: string]: string[] } = Object.values(packages).reduce((acc, curr) => {
    acc[curr.name] = [...curr.usedBy, ...curr.usedByDev]
    return acc
  }, {})

  return topo(dag) // TODO: this is now done by pnpm (top sort), can we remove?
}

function zeroOutPatch(version: string): string {
  const parts = version.split('.')
  parts[parts.length - 1] = '0'
  return parts.join('.')
}

/**
 * Takes the max dev version + 1
 * For now supporting X.Y.Z-dev.#
 * @param packages Local package definitions
 */
async function getNewDevVersion(packages: Packages): Promise<string> {
  const before = Math.round(performance.now())
  console.log('\nCalculating new dev version...')
  // Why are we calling zeroOutPatch?
  // Because here we're only interested in the 2.5.0 <- the next minor stable version
  // If the current version would be 2.4.7, we would end up with 2.5.7
  const nextStable = zeroOutPatch((await getNextMinorStable())!)

  console.log(`getNewDevVersion: Next minor stable: ${nextStable}`)

  const versions = await getAllVersionsPublishedFor(packages, 'dev', nextStable + '-dev')
  const maxDev = getMaxDevVersionIncrement(versions)

  const version = `${nextStable}-dev.${maxDev + 1}`
  console.log(`Got ${version} in ${Math.round(performance.now()) - before}ms`)
  return version
}

/**
 * Takes the max dev version + 1
 * For now supporting X.Y.Z-dev.#
 * @param packages Local package definitions
 */
async function getNewIntegrationVersion(packages: Packages, branch: string): Promise<string> {
  const before = Math.round(performance.now())
  console.log('\nCalculating new integration version...')
  // Why are we calling zeroOutPatch?
  // Because here we're only interested in the 2.5.0 <- the next minor stable version
  // If the current version would be 2.4.7, we would end up with 2.5.7
  const nextStable = zeroOutPatch((await getNextMinorStable())!)

  console.log(`getNewIntegrationVersion: Next minor stable: ${nextStable}`)

  const branchWithoutPrefix = branch.replace(/^integration\//, '')
  const versionNameSlug = `${nextStable}-integration-${slugify(branchWithoutPrefix)}`

  const versions = await getAllVersionsPublishedFor(packages, 'integration', versionNameSlug)
  const maxIntegration = getMaxIntegrationVersionIncrement(versions)

  const version = `${versionNameSlug}.${maxIntegration + 1}`

  // TODO: can we remove this?
  console.log(`Got ${version} in ${Math.round(performance.now()) - before}ms`)

  return version
}

// This function gets the current "patchMajorMinor" (major and minor of the patch branch),
// then retrieves the current versions of @prisma/client from npm,
// and filters that array down to the major and minor of the patch branch
// to figure out what the current highest patch number there currently is
async function getCurrentPatchForPatchVersions(patchMajorMinor: { major: number; minor: number }): Promise<number> {
  // TODO: could we add the name of the branch, as well as the relevant versions => faster
  //   $ npm view '@prisma/client@3.0.x' version --json
  // [
  // "3.0.1",
  // "3.0.2"
  // ]

  // We retry a few times if it fails
  // npm can have some hiccups
  const remoteVersionsString = await pRetry(
    async () => {
      return await runResult('.', 'npm view @prisma/client@* version --json')
    },
    {
      retries: 6,
      onFailedAttempt: (e) => {
        console.error(e)
      },
    },
  )
  let versions = JSON.parse(remoteVersionsString)

  // inconsistent npm api
  if (!Array.isArray(versions)) {
    versions = [versions]
  }

  const relevantVersions: Array<{
    major: number
    minor: number
    patch: number
  }> = versions
    .map((v) => {
      const match = semverRegex.exec(v)
      if (match?.groups) {
        return {
          major: Number(match.groups.major),
          minor: Number(match.groups.minor),
          patch: Number(match.groups.patch),
        }
      }
      return null
    })
    .filter((group) => group && group.minor === patchMajorMinor.minor && group.major === patchMajorMinor.major)

  if (relevantVersions.length === 0) {
    return 0
  }

  // sort descending by patch
  relevantVersions.sort((a, b) => {
    return a.patch < b.patch ? 1 : -1
  })

  return relevantVersions[0].patch
}

async function getNewPatchDevVersion(packages: Packages, patchBranch: string): Promise<string> {
  const patchMajorMinor = getSemverFromPatchBranch(patchBranch)
  if (!patchMajorMinor) {
    throw new Error(`Could not get major and minor for ${patchBranch}`)
  }
  const currentPatch = await getCurrentPatchForPatchVersions(patchMajorMinor)
  const newPatch = currentPatch + 1
  const newVersion = `${patchMajorMinor.major}.${patchMajorMinor.minor}.${newPatch}`
  const versions = [...(await getAllVersionsPublishedFor(packages, 'dev', newVersion))]
  const maxIncrement = getMaxPatchVersionIncrement(versions)

  return `${newVersion}-dev.${maxIncrement + 1}`
}

function getMaxDevVersionIncrement(versions: string[]): number {
  const regex = /\d+\.\d+\.\d+-dev\.(\d+)/
  const increments = versions
    .filter((v) => v.trim().length > 0)
    .map((v) => {
      const match = regex.exec(v)
      if (match) {
        return Number(match[1])
      }
      return 0
    })
    .filter((v) => v)
  return Math.max(...increments, 0)
}

function getMaxIntegrationVersionIncrement(versions: string[]): number {
  const regex = /\d+\.\d+\.\d+-integration.*\.(\d+)/
  const increments = versions
    .filter((v) => v.trim().length > 0)
    .map((v) => {
      const match = regex.exec(v)
      if (match) {
        return Number(match[1])
      }
      return 0
    })
    .filter((v) => v)

  return Math.max(...increments, 0)
}

// TODO: Adjust this for stable releases
function getMaxPatchVersionIncrement(versions: string[]): number {
  const regex = /\d+\.\d+\.\d+-dev\.(\d+)/
  const increments = versions
    .filter((v) => v.trim().length > 0)
    .map((v) => {
      const match = regex.exec(v)
      if (match && match[1]) {
        return Number(match[1])
      }
      return 0
    })
    .filter((v) => v)

  return Math.max(...increments, 0)
}

/**
 * @param pkgs
 * @param channel
 * @param prefix
 * @returns All versions published on npm for a given channel and prefix
 */
export async function getAllVersionsPublishedFor(pkgs: Packages, channel: string, prefix: string): Promise<string[]> {
  // We check the versions for the `@prisma/debug` package
  // Why?
  // Because `@prisma/debug` is the first package that will be published
  // So if npm fails to publish one of the packages,
  // we cannot republish on the same version on a next run
  const pkg = pkgs['@prisma/debug']

  const values = async (pkg: Package) => {
    const pkgVersions = [] as string[]
    if (pkg.version.startsWith(prefix)) {
      pkgVersions.push(pkg.version)
    }

    // We retry a few times if it fails
    // npm can have some hiccups
    const remoteVersionsString = await pRetry(
      async () => {
        return await runResult('.', `npm info ${pkg.name} versions --json`)
      },
      {
        retries: 6,
        onFailedAttempt: (e) => {
          console.error(e)
        },
      },
    )
    const remoteVersions: string = JSON.parse(remoteVersionsString)

    for (const remoteVersion of remoteVersions) {
      if (remoteVersion.includes(channel) && remoteVersion.startsWith(prefix) && !pkgVersions.includes(remoteVersion)) {
        pkgVersions.push(remoteVersion)
      }
    }

    return pkgVersions
  }

  return [...new Set(await values(pkg))]
}

/**
 * Only used when publishing to the `dev` and `integration` npm channels
 * (see `getNewDevVersion()` and `getNewIntegrationVersion()`)
 * @returns The next minor version for the `latest` channel
 * Example: If latest is `4.9.0` it will return `4.10.0`
 */
async function getNextMinorStable() {
  // We check the Prisma CLI `latest` version
  // We retry a few times if it fails
  // npm can have some hiccups
  const remoteVersionString = await pRetry(
    async () => {
      return await runResult('.', `npm info prisma version`)
    },
    {
      retries: 6,
      onFailedAttempt: (e) => {
        console.error(e)
      },
    },
  )
  return increaseMinor(remoteVersionString)
}

// TODO: could probably use the semver package
function getSemverFromPatchBranch(version: string) {
  // the branch name must match
  // number.number.x like 3.0.x or 2.29.x
  // as an exact match, no character before or after
  const regex = /^(\d+)\.(\d+)\.x$/
  const match = regex.exec(version)

  if (match) {
    return {
      major: Number(match[1]),
      minor: Number(match[2]),
    }
  }

  return undefined
}

// TODO: name this to main
async function publish() {
  const args = arg({
    '--publish': Boolean,
    '--dry-run': Boolean,
    '--release': String, // TODO What does that do? Can we remove this? probably
    '--test': Boolean,
  })

  if (!process.env.BUILDKITE_BRANCH) {
    throw new Error(`Missing env var BUILDKITE_BRANCH`)
  }

  if (process.env.DRY_RUN) {
    console.log(blue(bold(`\nThe DRY_RUN env var is set, so we'll do a dry run!\n`)))
    args['--dry-run'] = true
  }

  const dryRun = args['--dry-run'] ?? false

  // TODO: rename BUILDKITE_TAG
  if (args['--publish'] && process.env.BUILDKITE_TAG) {
    if (args['--release']) {
      throw new Error(`Can't provide env var BUILDKITE_TAG and --release at the same time`)
    }

    console.log(`Setting --release to BUILDKITE_TAG = ${process.env.BUILDKITE_TAG}`)
    args['--release'] = process.env.BUILDKITE_TAG // TODO: rename this var to RELEASE_VERSION
    // TODO: put this into a global variable VERSION
    // and then replace the args['--release'] with it
  }

  if (!args['--test'] && !args['--publish'] && !dryRun) {
    throw new Error('Please either provide --test or --publish or --dry-run')
  }

  if (args['--release']) {
    if (!semver.valid(args['--release'])) {
      throw new Error(`New release version ${bold(underline(args['--release']))} is not a valid semver version.`)
    }

    // TODO: this can probably be replaced by semver lib
    const releaseRegex = /\d{1,2}\.\d{1,2}\.\d{1,2}/
    if (!releaseRegex.test(args['--release'])) {
      throw new Error(
        `New release version ${bold(underline(args['--release']))} does not follow the stable naming scheme: ${bold(
          underline('x.y.z'),
        )}`,
      )
    }

    // If there is --release, it's always also --publish
    args['--publish'] = true
  }

  // makes sure that only have 1 publish job running at a time
  let unlock: undefined | (() => void)
  if (process.env.BUILDKITE && args['--publish']) {
    console.info(`Let's try to acquire a lock before continuing. (to avoid concurrent publishing)`)
    const before = Math.round(performance.now())
    // TODO: problem lock might not work for more than 2 jobs
    unlock = await acquireLock(process.env.BUILDKITE_BRANCH)
    const after = Math.round(performance.now())
    console.log(`Acquired lock after ${after - before}ms`)
  }

  try {
    // TODO: does this make more sense to be in our tests? or in the monorepo postinstall?
    const rawPackages = await getPackages()
    const packages = getPackageDependencies(rawPackages)
    const circles = getCircularDependencies(packages)
    if (circles.length > 0) {
      // TODO this can be done by esbuild
      throw new Error(`Oops, there are circular dependencies: ${circles}`)
    }

    let prismaVersion: undefined | string
    let tag: undefined | string
    let tagForEcosystemTestsCheck: undefined | string

    const patchBranch = getPatchBranch()
    console.log({ patchBranch })

    // TODO: can be refactored into one branch utility
    const branch = await getPrismaBranch()
    console.log({ branch })

    // For branches that are named "integration/" we publish to the integration npm tag
    if (branch && (process.env.FORCE_INTEGRATION_RELEASE || branch.startsWith('integration/'))) {
      prismaVersion = await getNewIntegrationVersion(packages, branch)
      tag = 'integration'
    }
    // Is it a patch branch? (Like 2.20.x)
    else if (patchBranch) {
      prismaVersion = await getNewPatchDevVersion(packages, patchBranch)
      tag = 'patch-dev'
      if (args['--release']) {
        tagForEcosystemTestsCheck = 'patch-dev' //?
        prismaVersion = args['--release']
        tag = 'latest'
      }
    } else if (args['--release']) {
      // TODO:Where each patch branch goes
      prismaVersion = args['--release']
      tag = 'latest'
      tagForEcosystemTestsCheck = 'dev'
    } else {
      prismaVersion = await getNewDevVersion(packages)
      tag = 'dev'
    }

    console.log({
      patchBranch,
      tag,
      tagForEcosystemTestsCheck,
      prismaVersion,
    })

    if (typeof process.env.GITHUB_OUTPUT == 'string' && process.env.GITHUB_OUTPUT.length > 0) {
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `patchBranch=${patchBranch}\n`)
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `tag=${tag}\n`)
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `tagForEcosystemTestsCheck=${tagForEcosystemTestsCheck}\n`)
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `prismaVersion=${prismaVersion}\n`)
    }

    if (!dryRun && args['--test']) {
      if (onlyPackages || skipPackages) {
        console.log(bold('\nTesting all packages was skipped because onlyPackages or skipPackages is set.'))
      } else {
        console.log(bold('\nTesting all packages...'))
        await testPackages(packages, getPublishOrder(packages))
      }
    }

    if (args['--publish'] || dryRun) {
      if (args['--release']) {
        if (!tagForEcosystemTestsCheck) {
          throw new Error(`tagForEcosystemTestsCheck missing`)
        }
        const passing = await areEcosystemTestsPassing(tagForEcosystemTestsCheck)
        if (!passing && !process.env.SKIP_ECOSYSTEMTESTS_CHECK) {
          throw new Error(`We can't release, as the ecosystem-tests are not passing for the ${tag} npm tag!
Check them out at https://github.com/prisma/ecosystem-tests/actions?query=workflow%3Atest+branch%3A${tag}`)
        }
      }

      const publishOrder = filterPublishOrder(getPublishOrder(packages), ['@prisma/integration-tests'])

      if (!dryRun) {
        console.log(`Let's first do a dry run!`)
        await publishPackages(packages, publishOrder, true, prismaVersion, tag, args['--release'])
        console.log(`Waiting 5 sec so you can check it out first...`)
        await new Promise((r) => setTimeout(r, 5_000))
      }

      await publishPackages(packages, publishOrder, dryRun, prismaVersion, tag, args['--release'])

      const enginesCommitHash = getEnginesCommitHash()
      const enginesCommitInfo = await getCommitInfo('prisma-engines', enginesCommitHash)
      const prismaCommitHash = await getLatestCommitHash('.')
      const prismaCommitInfo = await getCommitInfo('prisma', prismaCommitHash)

      if (typeof process.env.GITHUB_OUTPUT == 'string' && process.env.GITHUB_OUTPUT.length > 0) {
        fs.appendFileSync(process.env.GITHUB_OUTPUT, `enginesCommitHash=${enginesCommitHash}\n`)
        fs.appendFileSync(process.env.GITHUB_OUTPUT, `prismaCommitHash=${prismaCommitHash}\n`)
      }

      if (!args['--dry-run']) {
        try {
          await sendSlackMessage({
            version: prismaVersion,
            enginesCommitInfo,
            prismaCommitInfo,
          })
        } catch (e) {
          console.error(e)
        }

        try {
          await tagEnginesRepo(prismaVersion, enginesCommitHash, patchBranch, dryRun)
        } catch (e) {
          console.error(e)
        }
      }
    }
  } catch (e) {
    if (unlock) {
      unlock()
      unlock = undefined
    }
    throw e
  } finally {
    if (unlock) {
      unlock()
      unlock = undefined
    }
  }
}

function getEnginesCommitHash(): string {
  const npmEnginesVersion = dependenciesPrismaEnginesPkg['@prisma/engines-version']
  const sha1Pattern = /\b[0-9a-f]{5,40}\b/
  const commitHash = npmEnginesVersion.match(sha1Pattern)![0]

  return commitHash
}

async function tagEnginesRepo(
  prismaVersion: string,
  engineVersion: string,
  patchBranch: string | null,
  dryRun = false,
) {
  let previousTag: string

  console.log(`Going to tag the engines repo with "${prismaVersion}", patchBranch: ${patchBranch}, dryRun: ${dryRun}`)
  /** Get ready */
  await cloneOrPull('prisma-engines', dryRun)

  // 3.2.x
  if (patchBranch) {
    // 3.2
    const [major, minor] = patchBranch.split('.')
    const majorMinor = [major, minor].join('.')
    // ['3.2.0', '3.2.1']
    const patchesPublished: string | string[] = JSON.parse(
      // TODO this line is useful for retrieving versions
      await runResult('.', `npm view @prisma/client@${majorMinor} version --json`),
    )

    console.log({ patchesPublished })

    if (typeof patchesPublished === 'string') {
      previousTag = patchesPublished
    } else if (patchesPublished.length > 0) {
      // 3.2.0
      previousTag = patchesPublished.pop() as string
    } else {
      console.warn('No version found for this patch branch')
      return
    }
  } else {
    /** Get previous tag */
    previousTag = await runResult('prisma-engines', `git describe --tags --abbrev=0`)
  }

  /** Get commits between previous tag and engines sha1 */
  const changelog = await runResult(
    'prisma-engines',
    `git log ${previousTag}..${engineVersion} --pretty=format:' * %h - %s - by %an' --`,
  )

  // TODO remove later
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const changelogSanitized = changelog.replace(/"/gm, '\\"').replace(/`/gm, '\\`')

  if (typeof process.env.GITHUB_OUTPUT == 'string' && process.env.GITHUB_OUTPUT.length > 0) {
    // fs.appendFileSync(process.env.GITHUB_OUTPUT, `changelogSanitized=${changelogSanitized}\n`)
  }
}

/**
 * Tests packages in "publishOrder"
 * @param packages Packages
 * @param publishOrder string[][]
 */
async function testPackages(packages: Packages, publishOrder: string[][]): Promise<void> {
  const order = flatten(publishOrder)

  // If parallelism is set in build-kite we split the testing
  //  Job 0 - Node-API Library
  //    PRISMA_CLIENT_ENGINE_TYPE="library"
  //    PRISMA_CLI_QUERY_ENGINE_TYPE="library"
  //  Job 1 - Binary
  //    PRISMA_CLIENT_ENGINE_TYPE="binary"
  //    PRISMA_CLI_QUERY_ENGINE_TYPE="binary"
  if (process.env.BUILDKITE_PARALLEL_JOB === '0') {
    console.log('BUILDKITE_PARALLEL_JOB === 0 - Node-API Library')
  } else if (process.env.BUILDKITE_PARALLEL_JOB === '1') {
    console.log('BUILDKITE_PARALLEL_JOB === 1 - Binary')
  }

  console.log(bold(`\nRun ${cyan('tests')}. Testing order:`))
  console.log(order)

  for (const pkgName of order) {
    const pkg = packages[pkgName]
    if (pkg.packageJson.scripts.test) {
      console.log(`\nTesting ${magenta(pkg.name)}`)
      // Sets ENV to override engines
      if (process.env.BUILDKITE_PARALLEL_JOB === '0') {
        await run(
          path.dirname(pkg.path),
          'PRISMA_CLIENT_ENGINE_TYPE="library" PRISMA_CLI_QUERY_ENGINE_TYPE="library" pnpm run test --silent',
        )
      } else if (process.env.BUILDKITE_PARALLEL_JOB === '1') {
        await run(
          path.dirname(pkg.path),
          'PRISMA_CLIENT_ENGINE_TYPE="binary" PRISMA_CLI_QUERY_ENGINE_TYPE="binary" pnpm run test --silent',
        )
      } else {
        await run(path.dirname(pkg.path), 'pnpm run test')
      }
    } else {
      console.log(`\nSkipping ${magenta(pkg.name)}, as it doesn't have tests`)
    }
  }
}

function flatten<T>(arr: T[][]): T[] {
  return arr.reduce((acc, val) => acc.concat(val), [])
}

function intersection<T>(arr1: T[], arr2: T[]): T[] {
  return arr1.filter((value) => arr2.includes(value))
}

// Thanks 🙏 to https://github.com/semver/semver/issues/232#issuecomment-405596809
const semverRegex =
  /^(?<major>0|[1-9]\d*)\.(?<minor>0|[1-9]\d*)\.(?<patch>0|[1-9]\d*)(?:-(?<prerelease>(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+(?<buildmetadata>[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/

function increaseMinor(version: string) {
  const match = semverRegex.exec(version)
  if (match?.groups) {
    return `${match.groups.major}.${Number(match.groups.minor) + 1}.${match.groups.patch}`
  }

  return undefined
}

function filterPublishOrder(publishOrder: string[][], packages: string[]): string[][] {
  return publishOrder.reduce<string[][]>((acc, curr) => {
    if (Array.isArray(curr)) {
      curr = curr.filter((pkg) => !packages.includes(pkg))
      if (curr.length > 0) {
        acc.push(curr)
      }
    } else if (!packages.includes(curr)) {
      acc.push(curr)
    }

    return acc
  }, [])
}

async function publishPackages(
  packages: Packages,
  // TODO: pnpm can calculate this for us when using `pnpm -r publish`
  publishOrder: string[][],
  dryRun: boolean,
  prismaVersion: string,
  tag: string,
  releaseVersion?: string,
): Promise<void> {
  // we need to release a new `prisma` CLI in all cases.
  // if there is a change in prisma-client-js, it will also use this new version

  const publishStr = dryRun ? `${bold('Dry publish')} ` : releaseVersion ? 'Releasing ' : 'Publishing '

  if (releaseVersion) {
    console.log(red(bold(`RELEASE. This will release ${underline(releaseVersion)} on latest!!!`)))
    if (dryRun) {
      console.log(red(bold(`But it's only a dry run, so don't worry.`)))
    }
  }

  console.log(
    blue(
      `\n${bold(underline(prismaVersion))}: ${publishStr}(all) ${bold(
        String(Object.values(packages).length),
      )} packages. Publish order:`,
    ),
  )
  console.log(blue(publishOrder.map((o, i) => `  ${i + 1}. ${o.join(', ')}`).join('\n')))

  if (releaseVersion) {
    console.log(
      red(
        bold(
          `\nThis will ${underline('release')} a new version of Prisma packages on latest: ${underline(prismaVersion)}`,
        ),
      ),
    )
    if (!dryRun) {
      console.log(red('Are you sure you want to do this? We wait for 10s just in case...'))
      await new Promise((r) => {
        setTimeout(r, 10_000)
      })
    }
  } else if (!dryRun) {
    // For dev releases
    console.log(`\nGiving you 5s to review the changes...`)
    await new Promise((r) => {
      setTimeout(r, 5_000)
    })
  }

  for (const currentBatch of publishOrder) {
    for (const pkgName of currentBatch) {
      const pkg = packages[pkgName]

      if (pkg.private) {
        console.log(`Skipping ${magenta(pkg.name)} as it's private`)
        continue
      }

      // @prisma/engines-version is published outside of this script
      const packagesNotToPublish = ['@prisma/engines-version']
      if (packagesNotToPublish.includes(pkgName)) {
        continue
      }

      const pkgDir = path.dirname(pkg.path)

      const newVersion = prismaVersion

      console.log(`\nPublishing ${magenta(`${pkgName}@${newVersion}`)} ${dim(`on ${tag}`)}`)

      // Why is this needed?
      // Was introduced in the first version of this script on Apr 14, 2020
      // https://github.com/prisma/prisma/commit/7d6a26c1777c59ee945356687673102de4b1fe55#diff-51cd3eaba5264dc956e45fabcc02d5d21d8a8c473bd1bd00a297f9f4550c115bR790-R797
      const prismaDeps = [...pkg.uses, ...pkg.usesDev]
      if (prismaDeps.length > 0) {
        await pRetry(
          async () => {
            await run(pkgDir, `pnpm update ${prismaDeps.join(' ')} --filter "${pkgName}"`, dryRun)
          },
          {
            retries: 6,
            onFailedAttempt: (e) => {
              console.error(e)
            },
          },
        )
      }

      // set the version in package.json for current package
      await writeVersion(pkgDir, newVersion, dryRun)

      // For package `prisma`, get latest commit hash (that is being released)
      // and put into `prisma.prismaCommit` in `package.json` before publishing
      if (pkgName === 'prisma') {
        const latestCommitHash = await getLatestCommitHash('.')
        await writeToPkgJson(pkgDir, (pkg) => {
          pkg.prisma.prismaCommit = latestCommitHash
        })
      }

      if (!isSkipped(pkgName)) {
        /*
         *  About `--no-git-checks`
         *  By default, `pnpm publish` will make some checks before actually publishing a new version of your package.
         *  The next checks will happen:
         *  - The current branch is your publish branch. The publish branch is `master` by default. This is configurable through the `publish-branch` setting.
         *  - Your working directory is clean (there are no uncommitted changes).
         *  - The branch is up-to-date.
         */
        await run(pkgDir, `pnpm publish --no-git-checks --access public --tag ${tag}`, dryRun)
      }
    }
  }
}

function isSkipped(pkgName) {
  if (skipPackages && skipPackages.includes(pkgName)) {
    return true
  }

  if (onlyPackages && !onlyPackages.includes(pkgName)) {
    return true
  }

  return false
}

async function acquireLock(branch: string): Promise<() => void> {
  const before = Math.round(performance.now())
  if (!process.env.REDIS_URL) {
    console.log(bold(red(`REDIS_URL missing. Setting dummy lock`)))
    return () => {
      console.log(`Lock removed after ${Math.round(performance.now()) - before}ms`)
    }
  }
  const client = redis.createClient({
    url: process.env.REDIS_URL,
    retry_strategy: () => {
      return 1000
    },
  })
  const lock = promisify(require('redis-lock')(client))

  // get a lock of max 15 min
  // the lock is specific to the branch name
  const cb = await lock(`prisma-release-${branch}`, 15 * 60 * 1000)
  return async () => {
    cb()
    const after = Math.round(performance.now())
    console.log(`Lock removed after ${after - before}ms`)
    await new Promise((r) => setTimeout(r, 200))
    client.quit()
  }
}

async function writeToPkgJson(pkgDir, cb: (pkg: any) => any, dryRun?: boolean) {
  const pkgJsonPath = path.join(pkgDir, 'package.json')
  const file = await fs.promises.readFile(pkgJsonPath, 'utf-8')
  let packageJson = JSON.parse(file)
  if (dryRun) {
    console.log(`Would write to ${pkgJsonPath} from ${packageJson.version} now`)
  } else {
    const result = cb(packageJson)
    if (result) {
      packageJson = result
    }
    await fs.promises.writeFile(pkgJsonPath, JSON.stringify(packageJson, null, 2))
  }
}

async function writeVersion(pkgDir: string, version: string, dryRun?: boolean) {
  const pkgJsonPath = path.join(pkgDir, 'package.json')
  const file = await fs.promises.readFile(pkgJsonPath, 'utf-8')
  const packageJson = JSON.parse(file)
  if (dryRun) {
    console.log(`Would update ${pkgJsonPath} from ${packageJson.version} to ${version} now ${dim('(dry)')}`)
  } else {
    packageJson.version = version
    await fs.promises.writeFile(pkgJsonPath, JSON.stringify(packageJson, null, 2))
  }
}

async function getPrismaBranch(): Promise<string | undefined> {
  if (process.env.BUILDKITE_BRANCH) {
    return process.env.BUILDKITE_BRANCH
  }
  try {
    // TODO: this can probably be simplified, we don't publish locally, remove?
    return await runResult('.', 'git rev-parse --symbolic-full-name --abbrev-ref HEAD')
  } catch (e) {}

  return undefined
}

async function areEcosystemTestsPassing(tag: string): Promise<boolean> {
  let svgUrl = 'https://github.com/prisma/ecosystem-tests/workflows/test/badge.svg?branch='

  if (tag === 'patch-dev') {
    svgUrl += tag
  } else {
    svgUrl += 'dev'
  }

  const res = await fetch(svgUrl).then((r) => r.text())
  return res.includes('passing')
}

function getPatchBranch() {
  if (process.env.BUILDKITE_BRANCH) {
    const versions = getSemverFromPatchBranch(process.env.BUILDKITE_BRANCH)
    console.debug('versions from patch branch:', versions)

    if (versions !== undefined) {
      return process.env.BUILDKITE_BRANCH
    }
  }

  return null
}

type CommitInfo = {
  hash: string
  message: string
  author: string
}

type SlackMessageArgs = {
  version: string
  enginesCommitInfo: CommitInfo
  prismaCommitInfo: CommitInfo
  dryRun?: boolean
}

async function sendSlackMessage({ version, enginesCommitInfo, prismaCommitInfo, dryRun }: SlackMessageArgs) {
  const webhook = new IncomingWebhook(process.env.SLACK_RELEASE_FEED_WEBHOOK!)
  const dryRunStr = dryRun ? 'DRYRUN: ' : ''

  const prismaLines = getLines(prismaCommitInfo.message)
  const enginesLines = getLines(enginesCommitInfo.message)

  const authoredByString = (author: string) => {
    if (!author) return ''
    return `Authored by ${prismaCommitInfo.author}`
  }

  await webhook.send(
    `${dryRunStr}<https://www.npmjs.com/package/prisma/v/${version}|prisma@${version}> has just been released. Install via \`npm i -g prisma@${version}\` or \`npx prisma@${version}\`
What's shipped:
\`prisma/prisma\`
<https://github.com/prisma/prisma/commit/${prismaCommitInfo.hash}|${
      prismaLines[0]
    }\t\t\t\t-  ${prismaCommitInfo.hash.slice(0, 7)}>
${prismaLines.join('\n')}${prismaLines.length > 1 ? '\n' : ''}${authoredByString(prismaCommitInfo.author)}

\`prisma/prisma-engines\`
<https://github.com/prisma/prisma-engines/commit/${enginesCommitInfo.hash}|${
      enginesLines[0]
    }\t\t\t\t-  ${enginesCommitInfo.hash.slice(0, 7)}>
${enginesLines.join('\n')}${enginesLines.length > 1 ? '\n' : ''}${authoredByString(enginesCommitInfo.author)}`,
  )
}

function getLines(str: string): string[] {
  return str.split(/\r?\n|\r/)
}

type GitHubCommitInfo = {
  sha: string
  commit: {
    author: {
      name: string
      email: string
      date: string
    } | null
    committer: {
      name: string
      email: string
      date: string
    } | null
    message: string
    url: string
  }
}

async function getCommitInfo(repo: string, hash: string): Promise<CommitInfo> {
  // Example https://api.github.com/repos/prisma/prisma/commits/9d23845e98e34ec97f3013f5c2a3f85f57a828e2
  // Doc https://docs.github.com/en/free-pro-team@latest/rest/commits/commits?apiVersion=2022-11-28#get-a-commit
  const response = await fetch(`https://api.github.com/repos/prisma/${repo}/commits/${hash}`)
  const jsonData = (await response.json()) as GitHubCommitInfo

  return {
    message: jsonData.commit?.message || '',
    author: jsonData.commit?.author?.name || '',
    hash,
  }
}

function getCommitEnvVar(name: string): string {
  return `${name.toUpperCase().replace(/-/g, '_')}_COMMIT`
}

async function cloneOrPull(repo: string, dryRun = false) {
  if (fs.existsSync(path.join(__dirname, '../../', repo))) {
    return run(repo, `git pull --tags`, dryRun)
  } else {
    await run('.', `git clone ${repoUrl(repo)}`, dryRun)
    const envVar = getCommitEnvVar(repo)
    if (process.env[envVar]) {
      await run(repo, `git checkout ${process.env[envVar]}`, dryRun)
    }
  }

  return undefined
}

function repoUrl(repo: string, org = 'prisma') {
  return `https://github.com/${org}/${repo}.git`
}

if (require.main === module) {
  publish().catch((e) => {
    console.error(red(bold('Error: ')) + (e.stack || e.message))
    process.exit(1)
  })
}
