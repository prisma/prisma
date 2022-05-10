import slugify from '@sindresorhus/slugify'
import { IncomingWebhook } from '@slack/webhook'
import arg from 'arg'
import topo from 'batching-toposort'
import chalk from 'chalk'
import execa from 'execa'
import { existsSync, promises as fs } from 'fs'
import globby from 'globby'
import fetch from 'node-fetch'
import pMap from 'p-map'
import pReduce from 'p-reduce'
import pRetry from 'p-retry'
import path from 'path'
import redis from 'redis'
import semver from 'semver'
import { promisify } from 'util'

import { unique } from './unique'

export type Commit = {
  date: Date
  dir: string
  hash: string
  isMergeCommit: boolean
  parentCommits: string[]
}

async function getLatestChanges(): Promise<string[]> {
  return getChangesFromCommit(await getLatestCommit('.'))
}

async function getChangesFromCommit(commit: Commit): Promise<string[]> {
  const hashes = commit.isMergeCommit ? commit.parentCommits.join(' ') : commit.hash
  const changes = await runResult(commit.dir, `git diff-tree --no-commit-id --name-only -r ${hashes}`)
  if (changes.trim().length > 0) {
    return changes.split('\n').map((change) => path.join(commit.dir, change))
  } else {
    throw new Error(`No changes detected. This must not happen!`)
  }
}

async function getUnsavedChanges(dir: string): Promise<string | null> {
  const result = await runResult(dir, `git status --porcelain`)
  return result.trim() || null
}

async function getLatestCommit(dir: string): Promise<Commit> {
  if (process.env.GITHUB_CONTEXT) {
    const context = JSON.parse(process.env.GITHUB_CONTEXT)
    return context.sha
  }
  const result = await runResult(dir, 'git log --pretty=format:"%ad %H %P" --date=iso-strict -n 1')
  const [date, commit, ...parents] = result.split(' ')

  return {
    date: new Date(date),
    dir,
    hash: commit,
    isMergeCommit: parents.length > 1,
    parentCommits: parents,
  }
}

async function commitChanges(dir: string, message: string, dry = false): Promise<void> {
  await run(dir, `git commit -am "${message}"`, dry)
}

async function pull(dir: string, dry = false): Promise<void> {
  const branch = await getBranch(dir)
  if (process.env.BUILDKITE) {
    if (!process.env.GITHUB_TOKEN) {
      throw new Error(`Missing env var GITHUB_TOKEN`)
    }
  }
  await run(dir, `git pull origin ${branch} --no-edit`, dry)
}

async function push(dir: string, dry = false, branch?: string): Promise<void> {
  branch = branch ?? (await getBranch(dir))
  if (process.env.BUILDKITE) {
    if (!process.env.GITHUB_TOKEN) {
      throw new Error(`Missing env var GITHUB_TOKEN`)
    }
    await run(dir, `git push --quiet --set-upstream origin ${branch}`, dry)
  } else {
    await run(dir, `git push origin ${branch}`, dry)
  }
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
    throw new Error(
      chalk.red(`Error running ${chalk.bold(cmd)} in ${chalk.underline(cwd)}:`) + (e.stderr || e.stack || e.message),
    )
  }
}

/**
 * Runs a command and pipes the stdout & stderr to the current process.
 * @param cwd cwd for running the command
 * @param cmd command to run
 */
async function run(cwd: string, cmd: string, dry = false, hidden = false): Promise<void> {
  const args = [chalk.underline('./' + cwd).padEnd(20), chalk.bold(cmd)]
  if (dry) {
    args.push(chalk.dim('(dry)'))
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
    throw new Error(
      chalk.red(`Error running ${chalk.bold(cmd)} in ${chalk.underline(cwd)}:`) + (e.stderr || e.stack || e.message),
    )
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
      packageJson: JSON.parse(await fs.readFile(p, 'utf-8')),
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
  name: string
  path: string
  version: string
  usedBy: string[]
  usedByDev: string[]
  uses: string[]
  usesDev: string[]
  packageJson: any
}

interface PackageWithNewVersion extends Package {
  newVersion: string
}

type Packages = { [packageName: string]: Package }
type PackagesWithNewVersions = { [packageName: string]: PackageWithNewVersion }

export function getPackageDependencies(packages: RawPackages): Packages {
  const packageCache = Object.entries(packages).reduce<Packages>((acc, [name, pkg]) => {
    const usesDev = getPrismaDependencies(pkg.packageJson.devDependencies)
    acc[name] = {
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

async function getNewPackageVersions(packages: Packages, prismaVersion: string): Promise<PackagesWithNewVersions> {
  return pReduce(
    Object.values(packages),
    async (acc, p) => {
      acc[p.name] = {
        ...p,
        newVersion: await newVersion(p, prismaVersion),
      }
      return acc
    },
    {},
  )
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
  const before = Date.now()
  console.log('\nCalculating new dev version...')
  // Why are we calling zeroOutPatch?
  // Because here we're only interested in the 2.5.0 <- the next minor stable version
  // If the current version would be 2.4.7, we would end up with 2.5.7
  const nextStable = zeroOutPatch((await getNextMinorStable())!)

  console.log(`getNewDevVersion: Next minor stable: ${nextStable}`)

  const versions = await getAllVersions(packages, 'dev', nextStable + '-dev')
  const maxDev = getMaxDevVersionIncrement(versions)

  const version = `${nextStable}-dev.${maxDev + 1}`
  console.log(`Got ${version} in ${Date.now() - before}ms`)
  return version
}

/**
 * Takes the max dev version + 1
 * For now supporting X.Y.Z-dev.#
 * @param packages Local package definitions
 */
async function getNewIntegrationVersion(packages: Packages, branch: string): Promise<string> {
  const before = Date.now()
  console.log('\nCalculating new integration version...')
  // Why are we calling zeroOutPatch?
  // Because here we're only interested in the 2.5.0 <- the next minor stable version
  // If the current version would be 2.4.7, we would end up with 2.5.7
  const nextStable = zeroOutPatch((await getNextMinorStable())!)

  console.log(`getNewIntegrationVersion: Next minor stable: ${nextStable}`)

  const branchWithoutPrefix = branch.replace(/^integration\//, '')
  const versionNameSlug = `${nextStable}-integration-${slugify(branchWithoutPrefix)}`

  const versions = await getAllVersions(packages, 'integration', versionNameSlug)
  const maxIntegration = getMaxIntegrationVersionIncrement(versions)

  const version = `${versionNameSlug}.${maxIntegration + 1}`

  // TODO: can we remove this?
  console.log(`Got ${version} in ${Date.now() - before}ms`)

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
  let versions = JSON.parse(await runResult('.', 'npm view @prisma/client@* version --json'))

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
  const versions = [...(await getAllVersions(packages, 'dev', newVersion))]
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

// TODO: we can simplify this into one line (cc Joël)
async function getAllVersions(packages: Packages, channel: string, prefix: string): Promise<string[]> {
  return unique(
    flatten(
      await pMap(
        Object.values(packages).filter((p) => p.name !== '@prisma/integration-tests'),
        async (pkg) => {
          if (pkg.name === '@prisma/integration-tests') {
            return []
          }
          const pkgVersions = [] as string[]
          if (pkg.version.startsWith(prefix)) {
            pkgVersions.push(pkg.version)
          }
          const remoteVersionsString = await runResult('.', `npm info ${pkg.name} versions --json`)

          const remoteVersions = JSON.parse(remoteVersionsString)

          for (const remoteVersion of remoteVersions) {
            if (
              remoteVersion.includes(channel) &&
              remoteVersion.startsWith(prefix) &&
              !pkgVersions.includes(remoteVersion)
            ) {
              pkgVersions.push(remoteVersion)
            }
          }
          return pkgVersions
        },
        { concurrency: 3 }, // Let's not spam npm too much
      ),
    ),
  )
}

async function getNextMinorStable() {
  const remoteVersion = await runResult('.', `npm info prisma version`)

  return increaseMinor(remoteVersion)
}

// TODO: could probably use the semver package
function getSemverFromPatchBranch(version: string) {
  const regex = /(\d+)\.(\d+)\.x/
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
    '--repo': String, // TODO what is repo? Can we remove this? probably
    '--dry-run': Boolean,
    '--release': String, // TODO What does that do? Can we remove this? probably
    '--test': Boolean,
  })

  // TODO: can we remove this? probably
  if (process.env.BUILDKITE && process.env.PUBLISH_BUILD && !process.env.GITHUB_TOKEN) {
    throw new Error(`Missing env var GITHUB_TOKEN`)
  }

  if (!process.env.BUILDKITE_BRANCH) {
    throw new Error(`Missing env var BUILDKITE_BRANCH`)
  }

  if (process.env.DRY_RUN) {
    console.log(chalk.blue.bold(`\nThe DRY_RUN env var is set, so we'll do a dry run!\n`))
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

  if (process.env.BUILDKITE_TAG && !process.env.RELEASE_PROMOTE_DEV) {
    throw new Error(`When BUILDKITE_TAG is provided, RELEASE_PROMOTE_DEV also needs to be provided`)
  }

  if (!args['--test'] && !args['--publish'] && !dryRun) {
    throw new Error('Please either provide --test or --publish or --dry-run')
  }

  if (args['--release']) {
    if (!semver.valid(args['--release'])) {
      throw new Error(`New release version ${chalk.bold.underline(args['--release'])} is not a valid semver version.`)
    }

    // TODO: this can probably be replaced by semver lib
    const releaseRegex = /\d{1,2}\.\d{1,2}\.\d{1,2}/
    if (!releaseRegex.test(args['--release'])) {
      throw new Error(
        `New release version ${chalk.bold.underline(
          args['--release'],
        )} does not follow the stable naming scheme: ${chalk.bold.underline('x.y.z')}`,
      )
    }

    // If there is --release, it's always also --publish
    args['--publish'] = true
  }

  // makes sure that only have 1 publish job running at a time
  let unlock: undefined | (() => void)
  if (process.env.BUILDKITE && args['--publish']) {
    console.log(`We're in buildkite and will publish, so we will acquire a lock...`)
    const before = Date.now()
    unlock = await acquireLock(process.env.BUILDKITE_BRANCH) // TODO: problem lock might not work for more than 2 jobs
    const after = Date.now()
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
    // TODO: check if we really need GITHUB_CONTEXT
    // TODO: this is not useful anymore, the logic is
    if (!process.env.GITHUB_CONTEXT) {
      const changes = await getLatestChanges()

      console.log(chalk.bold(`Changed files:`))
      console.log(changes.map((c) => `  ${c}`).join('\n'))
    }

    let prismaVersion
    let tag: undefined | string
    let tagForEcosystemTestsCheck: undefined | string

    const patchBranch = getPatchBranch()
    console.log({ patchBranch })

    // TODO: can be refactored into one branch utility
    const branch = await getPrismaBranch()
    console.log({ branch })

    // For branches that are named "integration/" we publish to the integration npm tag
    if (branch && branch.startsWith('integration/')) {
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

    // TODO: investigate this
    const packagesWithVersions = await getNewPackageVersions(packages, prismaVersion)

    // TODO: can be removed probably
    if (process.env.UPDATE_STUDIO) {
      console.log(chalk.bold(`UPDATE_STUDIO is set, so we only update Prisma Client and all dependants.`))

      // We know, that Prisma Client and Prisma CLI are always part of the release.
      // Therefore, also Migrate is also always part of the release, as it depends on Prisma Client.
      // We can therefore safely update Studio, as migrate and Prisma CLI are depending on Studio
      const latestStudioVersion = await runResult('.', 'npm info @prisma/studio-server version')
      console.log(`UPDATE_STUDIO set true, so we're updating it to ${latestStudioVersion}`)
      console.log(`Active branch`)
      await run('.', 'git branch')
      console.log(`Let's check out main!`)
      await run('.', 'git checkout main')
      await run('.', `pnpm update  -r @prisma/studio-server@${latestStudioVersion}`)
    }

    if (!dryRun && args['--test']) {
      console.log(chalk.bold('\nTesting all packages...'))
      await testPackages(packages, getPublishOrder(packages))
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
        await publishPackages(packages, packagesWithVersions, publishOrder, true, prismaVersion, tag, args['--release'])
        console.log(`Waiting 5 sec so you can check it out first...`)
        await new Promise((r) => setTimeout(r, 5000))
      }

      await publishPackages(packages, packagesWithVersions, publishOrder, dryRun, prismaVersion, tag, args['--release'])

      const enginesCommit = await getEnginesCommit()
      const enginesCommitInfo = await getCommitInfo('prisma-engines', enginesCommit)
      const prismaCommit = await getLatestCommit('.')
      const prismaCommitInfo = await getCommitInfo('prisma', prismaCommit.hash)

      try {
        await sendSlackMessage({
          version: prismaVersion,
          enginesCommit: enginesCommitInfo,
          prismaCommit: prismaCommitInfo,
        })
      } catch (e) {
        console.error(e)
      }

      if (!process.env.PATCH_BRANCH && !args['--dry-run']) {
        try {
          await tagEnginesRepo(prismaVersion, enginesCommit, patchBranch, dryRun)
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

async function getEnginesCommit(): Promise<string> {
  const prisma2Path = path.resolve(process.cwd(), './packages/cli/package.json')
  const pkg = JSON.parse(await fs.readFile(prisma2Path, 'utf-8'))
  // const engineVersion = pkg.prisma.version
  const engineVersion = pkg.dependencies['@prisma/engines']?.split('.').slice(-1)[0]

  return engineVersion
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
    const patchesPublished: string[] = JSON.parse(
      // TODO this line is useful for retrieving versions
      await runResult('.', `npm view @prisma/client@${majorMinor} version --json`),
    )

    console.log({ patchesPublished })

    if (patchesPublished.length > 0) {
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
  const changelogSanitized = changelog.replace(/"/gm, '\\"').replace(/`/gm, '\\`')

  const remotes = dryRun ? [] : (await runResult('prisma-engines', `git remote`)).trim().split('\n')

  if (!remotes.includes('origin-push')) {
    await run(
      'prisma-engines',
      `git remote add origin-push https://${process.env.GITHUB_TOKEN}@github.com/prisma/prisma-engines.git`,
      dryRun,
      true,
    )
  }

  if (process.env.CI) {
    await run('.', `git config --global user.email "prismabots@gmail.com"`, dryRun)
    await run('.', `git config --global user.name "prisma-bot"`, dryRun)
  }

  /** Tag */
  await run(
    'prisma-engines',
    `git tag -a ${prismaVersion} ${engineVersion} -m "${prismaVersion}" -m "${engineVersion}" -m "${changelogSanitized}"`,
    dryRun,
  )

  /** Push */
  await run(`prisma-engines`, `git push origin-push ${prismaVersion}`, dryRun)
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

  console.log(chalk.bold(`\nRun ${chalk.cyanBright('tests')}. Testing order:`))
  console.log(order)

  for (const pkgName of order) {
    const pkg = packages[pkgName]
    if (pkg.packageJson.scripts.test) {
      console.log(`\nTesting ${chalk.magentaBright(pkg.name)}`)
      // Sets ENV to override engines
      if (process.env.BUILDKITE_PARALLEL_JOB === '0') {
        await run(
          path.dirname(pkg.path),
          'PRISMA_CLIENT_ENGINE_TYPE="library" PRISMA_CLI_QUERY_ENGINE_TYPE="library" pnpm run test',
        )
      } else if (process.env.BUILDKITE_PARALLEL_JOB === '1') {
        await run(
          path.dirname(pkg.path),
          'PRISMA_CLIENT_ENGINE_TYPE="binary" PRISMA_CLI_QUERY_ENGINE_TYPE="binary" pnpm run test',
        )
      } else {
        await run(path.dirname(pkg.path), 'pnpm run test')
      }
    } else {
      console.log(`\nSkipping ${chalk.magentaBright(pkg.name)}, as it doesn't have tests`)
    }
  }
}

function flatten<T>(arr: T[][]): T[] {
  return arr.reduce((acc, val) => acc.concat(val), [])
}

function intersection<T>(arr1: T[], arr2: T[]): T[] {
  return arr1.filter((value) => arr2.includes(value))
}

// Parent "version updating function", uses `patch` and `patchVersion`
async function newVersion(pkg: Package, prismaVersion: string) {
  const isPrisma2OrPhoton = ['@prisma/cli', 'prisma', '@prisma/client'].includes(pkg.name)
  return isPrisma2OrPhoton ? prismaVersion : await patch(pkg)
}

// Thanks 🙏 to https://github.com/semver/semver/issues/232#issuecomment-405596809
const semverRegex =
  /^(?<major>0|[1-9]\d*)\.(?<minor>0|[1-9]\d*)\.(?<patch>0|[1-9]\d*)(?:-(?<prerelease>(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+(?<buildmetadata>[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/

function patchVersion(version: string) {
  const match = semverRegex.exec(version)
  if (match?.groups) {
    return `${match.groups.major}.${match.groups.minor}.${Number(match.groups.patch) + 1}`
  }

  return undefined
}

function increaseMinor(version: string) {
  const match = semverRegex.exec(version)
  if (match?.groups) {
    return `${match.groups.major}.${Number(match.groups.minor) + 1}.${match.groups.patch}`
  }

  return undefined
}

async function patch(pkg: Package) {
  // if done locally, no need to get the latest version from npm (saves time)
  // if done in buildkite, we definitely want to check, if there's a newer version on npm
  // in buildkite, saving a few sec is not worth it
  if (!process.env.BUILDKITE) {
    return patchVersion(pkg.version)
  }

  const localVersion = pkg.version
  if (pkg.name === '@prisma/integration-tests') {
    return localVersion
  }
  const npmVersion = await runResult('.', `npm info ${pkg.name} version`)

  const maxVersion = semver.maxSatisfying([localVersion, npmVersion], '*', {
    loose: true,
    includePrerelease: true,
  })

  return patchVersion(maxVersion)
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
  changedPackages: PackagesWithNewVersions,
  publishOrder: string[][],
  dryRun: boolean,
  prismaVersion: string,
  tag: string,
  releaseVersion?: string,
): Promise<void> {
  // we need to release a new `prisma` CLI in all cases.
  // if there is a change in prisma-client-js, it will also use this new version

  const publishStr = dryRun ? `${chalk.bold('Dry publish')} ` : releaseVersion ? 'Releasing ' : 'Publishing '

  if (releaseVersion) {
    console.log(chalk.red.bold(`RELEASE. This will release ${chalk.underline(releaseVersion)} on latest!!!`))
    if (dryRun) {
      console.log(chalk.red.bold(`But it's only a dry run, so don't worry.`))
    }
  }

  console.log(
    chalk.blueBright(
      `\n${chalk.bold.underline(prismaVersion)}: ${publishStr}(all) ${chalk.bold(
        String(Object.values(packages).length),
      )} packages. Publish order:`,
    ),
  )
  console.log(chalk.blueBright(publishOrder.map((o, i) => `  ${i + 1}. ${o.join(', ')}`).join('\n')))

  if (releaseVersion) {
    console.log(
      chalk.red.bold(
        `\nThis will ${chalk.underline('release')} a new version of prisma CLI on latest: ${chalk.underline(
          prismaVersion,
        )}`,
      ),
    )
    if (!dryRun) {
      console.log(chalk.red('Are you sure you want to do this? We wait for 10s just in case...'))
      await new Promise((r) => {
        setTimeout(r, 10_000)
      })
    }
  } else if (!dryRun) {
    console.log(`\nGiving you 5s to review the changes...`)
    await new Promise((r) => {
      setTimeout(r, 5_000)
    })
  }

  for (const currentBatch of publishOrder) {
    for (const pkgName of currentBatch) {
      const pkg = packages[pkgName]

      if (pkg.name === '@prisma/integration-tests') {
        continue
      }

      // @prisma/engines & @prisma/engines-version are published outside of this script
      const packagesNotToPublish = ['@prisma/engines', '@prisma/engines-version']
      if (packagesNotToPublish.includes(pkgName)) {
        continue
      }

      const pkgDir = path.dirname(pkg.path)

      const newVersion = prismaVersion

      console.log(`\nPublishing ${chalk.magentaBright(`${pkgName}@${newVersion}`)} ${chalk.dim(`on ${tag}`)}`)

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
        const latestCommit = await getLatestCommit('.')
        await writeToPkgJson(pkgDir, (pkg) => {
          pkg.prisma.prismaCommit = latestCommit.hash
        })
      }

      const skipPackages: string[] = []
      if (!skipPackages.includes(pkgName)) {
        /*
         *  About `--no-git-checks`
         *  By default, `pnpm publish` will make some checks before actually publishing a new version of your package.
         *  The next checks will happen:
         *  - The current branch is your publish branch. The publish branch is `master` by default. This is configurable through the `publish-branch` setting.
         *  - Your working directory is clean (there are no uncommitted changes).
         *  - The branch is up-to-date.
         */
        await run(pkgDir, `pnpm publish --no-git-checks --tag ${tag}`, dryRun)
      }
    }
  }

  if (process.env.UPDATE_STUDIO || process.env.PATCH_BRANCH) {
    if (process.env.CI) {
      await run('.', `git config --global user.email "prismabots@gmail.com"`)
      await run('.', `git config --global user.name "prisma-bot"`)
    }
    await run(
      '.',
      `git remote set-url origin https://${process.env.GITHUB_TOKEN}@github.com/prisma/prisma.git`,
      dryRun,
      true,
    )
  }

  if (process.env.UPDATE_STUDIO) {
    await run('.', `git stash`, dryRun)
    await run('.', `git checkout main`, dryRun)
    await run('.', `git stash pop`, dryRun)
  }

  // for now only push when studio is being updated
  if (!process.env.BUILDKITE || process.env.UPDATE_STUDIO || process.env.PATCH_BRANCH) {
    const repo = path.join(__dirname, '../../../')
    // commit and push it :)
    // we try catch this, as this is not necessary for CI to succeed
    await run(repo, `git status`, dryRun)
    await pull(repo, dryRun).catch((e) => {
      if (process.env.PATCH_BRANCH) {
        console.error(e)
      } else {
        throw e
      }
    })

    try {
      const unsavedChanges = await getUnsavedChanges(repo)
      if (!unsavedChanges) {
        console.log(`\n${chalk.bold('Skipping')} commiting changes, as they're already commited`)
      } else {
        console.log(`\nCommiting changes`)
        const message = process.env.UPDATE_STUDIO ? 'Bump Studio' : 'Bump versions'
        await commitChanges(repo, `${message} [skip ci]`, dryRun)
      }
      const branch = process.env.PATCH_BRANCH
      await push(repo, dryRun, branch).catch(console.error)
    } catch (e) {
      console.error(e)
      console.error(`Ignoring this error, continuing`)
    }
  }
}

async function acquireLock(branch: string): Promise<() => void> {
  const before = Date.now()
  if (!process.env.REDIS_URL) {
    console.log(chalk.bold.red(`REDIS_URL missing. Setting dummy lock`))
    return () => {
      console.log(`Lock removed after ${Date.now() - before}ms`)
    }
  }
  const client = redis.createClient({
    url: process.env.REDIS_URL,
    retry_strategy: (options) => {
      return 1000
    },
  })
  const lock = promisify(require('redis-lock')(client))

  // get a lock of max 15 min
  const cb = await lock(`prisma2-build-${branch}`, 15 * 60 * 1000)
  return async () => {
    cb()
    console.log(`Lock removed after ${Date.now() - before}ms`)
    await new Promise((r) => setTimeout(r, 200))
    client.quit()
  }
}

async function writeToPkgJson(pkgDir, cb: (pkg: any) => any, dryRun?: boolean) {
  const pkgJsonPath = path.join(pkgDir, 'package.json')
  const file = await fs.readFile(pkgJsonPath, 'utf-8')
  let packageJson = JSON.parse(file)
  if (dryRun) {
    console.log(`Would write to ${pkgJsonPath} from ${packageJson.version} now`)
  } else {
    const result = cb(packageJson)
    if (result) {
      packageJson = result
    }
    await fs.writeFile(pkgJsonPath, JSON.stringify(packageJson, null, 2))
  }
}

async function writeVersion(pkgDir: string, version: string, dryRun?: boolean) {
  const pkgJsonPath = path.join(pkgDir, 'package.json')
  const file = await fs.readFile(pkgJsonPath, 'utf-8')
  const packageJson = JSON.parse(file)
  if (dryRun) {
    console.log(`Would update ${pkgJsonPath} from ${packageJson.version} to ${version} now ${chalk.dim('(dry)')}`)
  } else {
    packageJson.version = version
    await fs.writeFile(pkgJsonPath, JSON.stringify(packageJson, null, 2))
  }
}

async function getBranch(dir: string) {
  // TODO: this can probably be simplified
  return runResult(dir, 'git rev-parse --symbolic-full-name --abbrev-ref HEAD')
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
  // TODO: this can probably be removed
  if (process.env.PATCH_BRANCH) {
    return process.env.PATCH_BRANCH
  }

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
  enginesCommit: CommitInfo
  prismaCommit: CommitInfo
  dryRun?: boolean
}

async function sendSlackMessage({ version, enginesCommit, prismaCommit, dryRun }: SlackMessageArgs) {
  const webhook = new IncomingWebhook(process.env.SLACK_RELEASE_FEED_WEBHOOK!)
  const dryRunStr = dryRun ? 'DRYRUN: ' : ''
  const prismaLines = getLines(prismaCommit.message)
  const enginesLines = getLines(enginesCommit.message)
  await webhook.send(
    `${dryRunStr}<https://www.npmjs.com/package/prisma/v/${version}|prisma@${version}> has just been released. Install via \`npm i -g prisma@${version}\` or \`npx prisma@${version}\`
What's shipped:
\`prisma/prisma\`
<https://github.com/prisma/prisma/commit/${prismaCommit.hash}|${prismaLines[0]}\t\t\t\t-  ${prismaCommit.hash.slice(
      0,
      7,
    )}>
${prismaLines.slice(1).join('\n')}${prismaLines.length > 1 ? '\n' : ''}Authored by ${prismaCommit.author}

\`prisma/prisma-engines\`
<https://github.com/prisma/prisma-engines/commit/${enginesCommit.hash}|${
      enginesLines[0]
    }\t\t\t\t-  ${enginesCommit.hash.slice(0, 7)}>
${enginesLines.slice(1).join('\n')}${enginesLines.length > 1 ? '\n' : ''}Authored by ${enginesCommit.author}`,
  )
}

function getLines(str: string): string[] {
  return str.split(/\r?\n|\r/)
}

async function getCommitInfo(repo: string, hash: string): Promise<CommitInfo> {
  const response = await fetch(`https://api.github.com/repos/prisma/${repo}/commits/${hash}`)

  const jsonData = await response.json()

  return {
    message: jsonData.commit?.message || '',
    author: jsonData.commit?.author.name || '',
    hash,
  }
}

function getCommitEnvVar(name: string): string {
  return `${name.toUpperCase().replace(/-/g, '_')}_COMMIT`
}

async function cloneOrPull(repo: string, dryRun = false) {
  if (existsSync(path.join(__dirname, '../../', repo))) {
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
    console.error(chalk.red.bold('Error: ') + (e.stack || e.message))
    process.exit(1)
  })
}
