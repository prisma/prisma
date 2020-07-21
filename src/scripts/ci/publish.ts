import chalk from 'chalk'
import execa from 'execa'
import path from 'path'
import globby from 'globby'
import topo from 'batching-toposort'
import { promises as fs } from 'fs'
import arg from 'arg'
import semver from 'semver'
import pReduce from 'p-reduce'
import redis from 'redis'
import fetch from 'node-fetch'
import { promisify } from 'util'
import { cloneOrPull } from '../setup'
import { unique } from './unique'
import pMap from 'p-map'

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
  const hashes = commit.isMergeCommit
    ? commit.parentCommits.join(' ')
    : commit.hash
  const changes = await runResult(
    commit.dir,
    `git diff-tree --no-commit-id --name-only -r ${hashes}`,
  )
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
  const result = await runResult(
    dir,
    'git log --pretty=format:"%ad %H %P" --date=iso-strict -n 1',
  )
  const [date, commit, ...parents] = result.split(' ')

  return {
    date: new Date(date),
    dir,
    hash: commit,
    isMergeCommit: parents.length > 1,
    parentCommits: parents,
  }
}

async function commitChanges(
  dir: string,
  message: string,
  dry = false,
): Promise<void> {
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
  } catch (e) {
    throw new Error(
      chalk.red(
        `Error running ${chalk.bold(cmd)} in ${chalk.underline(cwd)}:`,
      ) + (e.stderr || e.stack || e.message),
    )
  }
}

/**
 * Runs a command and pipes the stdout & stderr to the current process.
 * @param cwd cwd for running the command
 * @param cmd command to run
 */
async function run(
  cwd: string,
  cmd: string,
  dry: boolean = false,
  hidden: boolean = false,
): Promise<void> {
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
        SKIP_GENERATE: 'true',
      },
    })
  } catch (e) {
    throw new Error(
      chalk.red(
        `Error running ${chalk.bold(cmd)} in ${chalk.underline(cwd)}:`,
      ) + (e.stderr || e.stack || e.message),
    )
  }
}

type RawPackage = {
  path: string
  packageJson: any
}
type RawPackages = { [packageName: string]: RawPackage }

export async function getPackages(): Promise<RawPackages> {
  const packagePaths = await globby(
    ['packages/*/package.json'],
    {
      ignore: ['**/node_modules/**', '**/examples/**', '**/fixtures/**'],
    } as any, // TODO: Apparently upgrading to ts 3.7.2 broke this
  )
  const packages = await Promise.all(
    packagePaths.map(async (p) => ({
      path: p,
      packageJson: JSON.parse(await fs.readFile(p, 'utf-8')),
    })),
  )

  return packages.reduce<RawPackages>((acc, p: any) => {
    // TODO: Apparently upgrading to ts 3.7.2 broke this
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
  const packageCache = Object.entries(packages).reduce<Packages>(
    (acc, [name, pkg]) => {
      acc[name] = {
        version: pkg.packageJson.version,
        name,
        path: pkg.path,
        usedBy: [],
        usedByDev: [],
        uses: getPrismaDependencies(pkg.packageJson.dependencies),
        usesDev: getPrismaDependencies(pkg.packageJson.devDependencies),
        packageJson: pkg.packageJson,
      }

      return acc
    },
    {},
  )

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

function getPrismaDependencies(dependencies?: {
  [name: string]: string
}): string[] {
  if (!dependencies) {
    return []
  }
  return Object.keys(dependencies).filter(
    (d) => d.startsWith('@prisma') && !d.startsWith('@prisma/studio'),
  )
}

function getCircularDependencies(packages: Packages): string[][] {
  const circularDeps = []
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

async function getNewPackageVersions(
  packages: Packages,
  prisma2Version: string,
): Promise<PackagesWithNewVersions> {
  return pReduce(
    Object.values(packages),
    async (acc, p) => {
      acc[p.name] = {
        ...p,
        newVersion: await newVersion(p, prisma2Version),
      }
      return acc
    },
    {},
  )
}

export function getPublishOrder(packages: Packages): string[][] {
  const dag: { [pkg: string]: string[] } = Object.values(packages).reduce(
    (acc, curr) => {
      acc[curr.name] = [...curr.usedBy, ...curr.usedByDev]
      return acc
    },
    {},
  )

  return topo(dag)
}

function zeroOutPatch(version: string): string {
  const parts = version.split('.')
  parts[parts.length - 1] = '0'
  return parts.join('.')
}

/**
 * Takes the max dev version + 1
 * For now supporting 2.Y.Z-dev.#
 * @param packages Local package definitions
 */
async function getNewDevVersion(packages: Packages): Promise<string> {
  const before = Date.now()
  console.log('\nCalculating new dev version...')
  // Why are we calling zeroOutPatch?
  // Because here we're only interested in the 2.5.0 <- the next minor stable version
  // If the current version would be 2.4.7, we would end up with 2.5.7
  const nextStable = zeroOutPatch(await getNextMinorStable())

  console.log(`Next minor stable: ${nextStable}`)

  const versions = await getAllVersions(packages, 'dev', nextStable + '-dev')
  const devVersions = getDevVersionIncrements(versions)
  const maxDev = Math.max(...devVersions, 0)

  const version = `${nextStable}-dev.${maxDev + 1}`
  console.log(`Got ${version} in ${Date.now() - before}ms`)
  return version
}

async function getCurrentPatchForMinor(minor: number): Promise<number> {
  let versions = JSON.parse(
    await runResult('.', 'npm show @prisma/client@* version --json'),
  )

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
      if (match) {
        return {
          major: Number(match.groups.major),
          minor: Number(match.groups.minor),
          patch: Number(match.groups.patch),
        }
      }
      return null
    })
    .filter((group) => group && group.minor === minor)

  if (relevantVersions.length === 0) {
    return 0
  }

  // sort descending by patch
  relevantVersions.sort((a, b) => {
    return a.patch < b.patch ? 1 : -1
  })

  return relevantVersions[0].patch
}

// TODO: This logic needs to be updated for the next time we want to patch
async function getNewPatchDevVersion(
  packages: Packages,
  patchBranch: string,
): Promise<string> {
  const minor = getMinorFromPatchBranch(patchBranch)
  const currentPatch = await getCurrentPatchForMinor(minor)
  const newPatch = currentPatch + 1
  const newVersion = `2.${minor}.${newPatch}`
  const versions = [...(await getAllVersions(packages, 'dev', newVersion))]
  const maxIncrement = getMaxPatchVersionIncrement(versions)

  return `${newVersion}-dev.${maxIncrement + 1}`
}

function getDevVersionIncrements(versions: string[]): number[] {
  const regex = /2\.\d+\.\d+-dev\.(\d+)/
  return versions
    .filter((v) => v.trim().length > 0)
    .map((v) => {
      const match = regex.exec(v)
      if (match) {
        return Number(match[1])
      }
      return null
    })
    .filter((v) => v)
}

// TODO: Adjust this for stable releases
function getMaxPatchVersionIncrement(versions: string[]): number {
  const regex = /2\.\d+\.\d+-dev\.(\d+)/
  const increments = versions
    .filter((v) => v.trim().length > 0)
    .map((v) => {
      const match = regex.exec(v)
      if (match && match[1]) {
        return Number(match[1])
      }
      return null
    })
    .filter((v) => v)

  return Math.max(...increments, 0)
}

async function getAllVersions(
  packages: Packages,
  channel: string,
  prefix: string,
): Promise<string[]> {
  return unique(
    flatten(
      await pMap(
        Object.values(packages),
        async (pkg) => {
          const pkgVersions = []
          if (pkg.version.startsWith(prefix)) {
            pkgVersions.push(pkg.version)
          }
          const remoteVersionsString = await runResult(
            '.',
            `npm info ${pkg.name} versions --json`,
          )

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

async function getNextMinorStable(): Promise<string | null> {
  const remoteVersion = await runResult('.', `npm info @prisma/cli version`)

  return increaseMinor(remoteVersion)
}

// TODO: Adjust this for stable release
function getMinorFromPatchBranch(version: string): number | null {
  const regex = /2\.(\d+)\.x/
  const match = regex.exec(version)

  if (match) {
    return Number(match[1])
  }

  return null
}

async function publish() {
  const args = arg({
    '--publish': Boolean,
    '--repo': String,
    '--dry-run': Boolean,
    '--release': String,
    '--test': Boolean,
  })

  if (
    process.env.BUILDKITE &&
    process.env.PUBLISH_BUILD &&
    !process.env.GITHUB_TOKEN
  ) {
    throw new Error(`Missing env var GITHUB_TOKEN`)
  }

  if (process.env.DRY_RUN) {
    console.log(
      chalk.blue.bold(`\nThe DRY_RUN env var is set, so we'll do a dry run!\n`),
    )
    args['--dry-run'] = true
  }

  const dryRun = args['--dry-run']

  if (args['--publish'] && process.env.BUILDKITE_TAG) {
    if (args['--release']) {
      throw new Error(
        `Can't provide env var BUILDKITE_TAG and --release at the same time`,
      )
    }

    console.log(
      `Setting --release to BUILDKITE_TAG = ${process.env.BUILDKITE_TAG}`,
    )
    args['--release'] = process.env.BUILDKITE_TAG
  }

  if (process.env.BUILDKITE_TAG && !process.env.RELEASE_PROMOTE_DEV) {
    throw new Error(
      `When BUILDKITE_TAG is provided, RELEASE_PROMOTE_DEV also needs to be provided`,
    )
  }

  if (!args['--test'] && !args['--publish'] && !dryRun) {
    throw new Error('Please either provide --test or --publish or --dry-run')
  }

  if (args['--release']) {
    if (!semver.valid(args['--release'])) {
      throw new Error(
        `New release version ${chalk.bold.underline(
          args['--release'],
        )} is not a valid semver version.`,
      )
    }
    const releaseRegex = /2\.\d{1,2}\.\d{1,2}/
    if (
      !args['--release'].startsWith('2.') ||
      !releaseRegex.test(args['--release'])
    ) {
      throw new Error(
        `New release version ${chalk.bold.underline(
          args['--release'],
        )} does not follow the stable naming scheme: ${chalk.bold.underline(
          '2.x.y',
        )}`,
      )
    }

    // If there is --release, it's always also --publish
    args['--publish'] = true
  }

  let unlock: undefined | (() => void)
  if (process.env.BUILDKITE && args['--publish']) {
    console.log(
      `We're in buildkite and will publish, so we will acquire a lock...`,
    )
    const before = Date.now()
    unlock = await acquireLock()
    const after = Date.now()
    console.log(`Acquired lock after ${after - before}ms`)
  }

  try {
    const rawPackages = await getPackages()
    const packages = getPackageDependencies(rawPackages)
    const circles = getCircularDependencies(packages)
    if (circles.length > 0) {
      throw new Error(`Oops, there are circular dependencies: ${circles}`)
    }

    const changes = await getLatestChanges()

    console.log(chalk.bold(`Changed files:`))
    console.log(changes.map((c) => `  ${c}`).join('\n'))

    let prisma2Version
    const patchBranch = getPatchBranch()
    console.log({ patchBranch })
    if (args['--release']) {
      prisma2Version = args['--release']
    } else if (patchBranch) {
      // TODO Check if PATCH_BRANCH work!
      prisma2Version = await getNewPatchDevVersion(packages, patchBranch)
    } else {
      prisma2Version = await getNewDevVersion(packages)
    }

    const packagesWithVersions = await getNewPackageVersions(
      packages,
      prisma2Version,
    )

    if (process.env.UPDATE_STUDIO) {
      console.log(
        chalk.bold(
          `UPDATE_STUDIO is set, so we only update Prisma Client and all dependants.`,
        ),
      )
    }

    if (!dryRun && args['--test']) {
      console.log(chalk.bold('\nTesting packages'))
      await testPackages(packages, getPublishOrder(packages))
    }

    if (args['--publish'] || dryRun) {
      // We know, that Photon and Prisma2 are always part of the release.
      // Therefore, also migrate is also always part of the release, as it depends on photon.
      // We can therefore safely update studio, as migrate and prisma2 are depending on studio

      if (process.env.UPDATE_STUDIO) {
        const latestStudioVersion = await runResult(
          '.',
          'npm info @prisma/studio-transports version',
        )
        console.log(
          `UPDATE_STUDIO set true, so we're updating it to ${latestStudioVersion}`,
        )
        console.log(`Active branch`)
        await run('.', 'git branch')
        console.log(`Let's check out master!`)
        await run('.', 'git checkout master')
        await run(
          '.',
          `pnpm update  -r @prisma/studio@${latestStudioVersion} @prisma/studio-transports@${latestStudioVersion} @prisma/studio-server@${latestStudioVersion} @prisma/studio-types@${latestStudioVersion}`,
        )
      }

      if (args['--release']) {
        const passing = await areEndToEndTestsPassing()
        if (!passing) {
          throw new Error(`We can't release, as the e2e tests are not passing!
Check them out at https://github.com/prisma/e2e-tests/actions?query=workflow%3Atest+branch%3Amaster`)
        }
      }

      if (!dryRun) {
        console.log(`Let's first do a dry run!`)
        await publishPackages(
          packages,
          packagesWithVersions,
          getPublishOrder(packages),
          true,
          prisma2Version,
          args['--release'],
          patchBranch,
        )
        console.log(`Waiting 5 sec so you can check it out first...`)
        await new Promise((r) => setTimeout(r, 5000))
      }

      await publishPackages(
        packages,
        packagesWithVersions,
        getPublishOrder(packages),
        dryRun,
        prisma2Version,
        args['--release'],
        patchBranch,
      )

      if (!process.env.PATCH_BRANCH) {
        try {
          await tagEnginesRepo(dryRun)
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

async function tagEnginesRepo(dryRun = false) {
  console.log(`Going to tag the engines repo dryRun: ${dryRun}`)
  /** Get ready */
  await cloneOrPull('prisma-engines', dryRun)
  const remotes = dryRun
    ? []
    : (await runResult('prisma-engines', `git remote`)).trim().split('\n')

  if (!remotes.includes('origin-push')) {
    await run(
      'prisma-engines',
      `git remote add origin-push https://${process.env.GITHUB_TOKEN}@github.com/prisma/prisma-engines.git`,
      dryRun,
      true,
    )
  }
  await run(
    '.',
    `git config --global user.email "prismabots@gmail.com"`,
    dryRun,
  )
  await run('.', `git config --global user.name "prisma-bot"`, dryRun)

  /** Get version */
  const prisma2Path = path.resolve(process.cwd(), './packages/cli/package.json')
  const pkg = JSON.parse(await fs.readFile(prisma2Path, 'utf-8'))
  const engineVersion = pkg.prisma.version
  const packageVersion = pkg.version

  /** Tag */
  await run(
    'prisma-engines',
    `git tag -a ${packageVersion} ${engineVersion} -m "${packageVersion}"`,
    dryRun,
  )

  /** Push */
  await run(`prisma-engines`, `git push origin-push ${packageVersion}`, dryRun)
}

/**
 * Tests packages in "publishOrder"
 * @param packages Packages
 * @param publishOrder string[][]
 */
async function testPackages(
  packages: Packages,
  publishOrder: string[][],
): Promise<void> {
  const order = flatten(publishOrder)
  console.log(chalk.bold(`\nRun ${chalk.cyanBright('tests')}. Testing order:`))
  console.log(order)
  for (const pkgName of order) {
    const pkg = packages[pkgName]
    if (pkg.packageJson.scripts.test) {
      console.log(`\nTesting ${chalk.magentaBright(pkg.name)}`)
      await run(path.dirname(pkg.path), 'pnpm run test')
    } else {
      console.log(
        `\nSkipping ${chalk.magentaBright(pkg.name)}, as it doesn't have tests`,
      )
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
async function newVersion(pkg: Package, prisma2Version: string) {
  const isPrisma2OrPhoton = ['@prisma/cli', '@prisma/client'].includes(pkg.name)
  return isPrisma2OrPhoton ? prisma2Version : await patch(pkg)
}

const semverRegex = /^(?<major>0|[1-9]\d*)\.(?<minor>0|[1-9]\d*)\.(?<patch>0|[1-9]\d*)(?:-(?<prerelease>(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+(?<buildmetadata>[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/

function patchVersion(version: string): string | null {
  // Thanks 🙏 to https://github.com/semver/semver/issues/232#issuecomment-405596809

  const match = semverRegex.exec(version)
  if (match) {
    return `${match.groups.major}.${match.groups.minor}.${
      Number(match.groups.patch) + 1
    }`
  }

  return null
}

function increaseMinor(version: string): string | null {
  const match = semverRegex.exec(version)
  if (match) {
    return `${match.groups.major}.${Number(match.groups.minor) + 1}.${
      match.groups.patch
    }`
  }

  return null
}

async function patch(pkg: Package): Promise<string> {
  // if done locally, no need to get the latest version from npm (saves time)
  // if done in buildkite, we definitely want to check, if there's a newer version on npm
  // in buildkite, saving a few sec is not worth it
  if (!process.env.BUILDKITE) {
    return patchVersion(pkg.version)
  }

  const localVersion = pkg.version
  const npmVersion = await runResult('.', `npm info ${pkg.name} version`)

  const maxVersion = semver.maxSatisfying([localVersion, npmVersion], '*', {
    loose: true,
    includePrerelease: true,
  })

  return patchVersion(maxVersion)
}

async function publishPackages(
  packages: Packages,
  changedPackages: PackagesWithNewVersions,
  publishOrder: string[][],
  dryRun: boolean,
  prisma2Version: string,
  releaseVersion?: string,
  patchBranch?: string,
): Promise<void> {
  // we need to release a new @prisma/cli in all cases.
  // if there is a change in photon, photon will also use this new version

  const publishStr = dryRun
    ? `${chalk.bold('Dry publish')} `
    : releaseVersion
    ? 'Releasing '
    : 'Publishing '

  if (releaseVersion) {
    console.log(
      chalk.red.bold(
        `RELEASE. This will release ${chalk.underline(
          releaseVersion,
        )} on latest!!!`,
      ),
    )
    if (dryRun) {
      console.log(chalk.red.bold(`But it's only a dry run, so don't worry.`))
    }
  }

  console.log(
    chalk.blueBright(
      `\n${chalk.bold.underline(
        prisma2Version,
      )}: ${publishStr}(all) ${chalk.bold(
        String(Object.values(packages).length),
      )} packages. Publish order:`,
    ),
  )
  console.log(
    chalk.blueBright(
      publishOrder.map((o, i) => `  ${i + 1}. ${o.join(', ')}`).join('\n'),
    ),
  )

  if (releaseVersion) {
    console.log(
      chalk.red.bold(
        `\nThis will ${chalk.underline(
          'release',
        )} a new version of @prisma/cli on latest: ${chalk.underline(
          prisma2Version,
        )}`,
      ),
    )
    if (!dryRun) {
      console.log(
        chalk.red(
          'Are you absolutely sure you want to do this? We wait for 10secs just in case...',
        ),
      )
      await new Promise((r) => {
        setTimeout(r, 10000)
      })
    }
  } else if (!dryRun) {
    console.log(`\nGiving you 5sec to review the changes...`)
    await new Promise((r) => {
      setTimeout(r, 5000)
    })
  }

  for (const currentBatch of publishOrder) {
    for (const pkgName of currentBatch) {
      const pkg = packages[pkgName]
      const pkgDir = path.dirname(pkg.path)
      const tag =
        patchBranch && !process.env.BUILDKITE_TAG
          ? 'patch-dev'
          : prisma2Version.includes('dev')
          ? 'dev'
          : 'latest'

      let newVersion = prisma2Version
      if (
        pkgName === '@prisma/engine-core' &&
        process.env.BUILDKITE_TAG === '2.0.1'
      ) {
        newVersion = '2.0.1-1'
      }

      console.log(
        `\nPublishing ${chalk.magentaBright(
          `${pkgName}@${newVersion}`,
        )} ${chalk.dim(`on ${tag}`)}`,
      )

      const prismaDeps = [...pkg.uses, ...pkg.usesDev]
      if (prismaDeps.length > 0) {
        await run(
          pkgDir,
          `pnpm update ${prismaDeps.join(' ')} --filter "${pkgName}"`,
          dryRun,
        )
      }

      await writeVersion(pkgDir, newVersion, dryRun)

      if (pkgName === '@prisma/cli') {
        const latestCommit = await getLatestCommit('.')
        await writeToPkgJson(pkgDir, (pkg) => {
          pkg.prisma.prismaCommit = latestCommit.hash
        })
      }

      if (process.env.BUILDKITE) {
        await run(pkgDir, `pnpm run build`, dryRun)
      }
      const skipPackages =
        process.env.BUILDKITE_TAG === '2.0.1'
          ? [
              '@prisma/debug',
              '@prisma/get-platform',
              '@prisma/generator-helper',
              '@prisma/ink-components',
              '@prisma/fetch-engine',
            ]
          : []
      if (!skipPackages.includes(pkgName)) {
        await run(pkgDir, `pnpm publish --no-git-checks --tag ${tag}`, dryRun)
      }
    }
  }

  if (process.env.UPDATE_STUDIO || process.env.PATCH_BRANCH) {
    await run('.', `git config --global user.email "prismabots@gmail.com"`)
    await run('.', `git config --global user.name "prisma-bot"`)
    await run(
      '.',
      `git remote set-url origin https://${process.env.GITHUB_TOKEN}@github.com/prisma/prisma.git`,
      dryRun,
      true,
    )
  }

  if (process.env.UPDATE_STUDIO) {
    await run('.', `git stash`, dryRun)
    await run('.', `git checkout master`, dryRun)
    await run('.', `git stash pop`, dryRun)
  }

  // for now only push when studio is being updated
  if (
    !process.env.BUILDKITE ||
    process.env.UPDATE_STUDIO ||
    process.env.PATCH_BRANCH
  ) {
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
        console.log(
          `\n${chalk.bold(
            'Skipping',
          )} commiting changes, as they're already commited`,
        )
      } else {
        console.log(`\nCommiting changes`)
        const message = process.env.UPDATE_STUDIO
          ? 'Bump Studio'
          : 'Bump versions'
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

async function acquireLock(): Promise<() => void> {
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
  const cb = await lock('prisma2-build', 15 * 60 * 1000)
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
    console.log(
      `Would update ${pkgJsonPath} from ${
        packageJson.version
      } to ${version} now ${chalk.dim('(dry)')}`,
    )
  } else {
    packageJson.version = version
    await fs.writeFile(pkgJsonPath, JSON.stringify(packageJson, null, 2))
  }
}

if (!module.parent) {
  publish().catch((e) => {
    console.error(chalk.red.bold('Error: ') + (e.stack || e.message))
    process.exit(1)
  })
}

async function getBranch(dir: string) {
  return runResult(dir, 'git rev-parse --symbolic-full-name --abbrev-ref HEAD')
}

async function areEndToEndTestsPassing(): Promise<boolean> {
  const res = await fetch(
    'https://github.com/prisma/e2e-tests/workflows/test/badge.svg',
  ).then((r) => r.text())
  return res.includes('passing')
}

function getPatchBranch(): string | null {
  if (process.env.PATCH_BRANCH) {
    return process.env.PATCH_BRANCH
  }

  if (process.env.BUILDKITE_BRANCH) {
    const minor = getMinorFromPatchBranch(process.env.BUILDKITE_BRANCH)
    if (minor !== null) {
      return process.env.BUILDKITE_BRANCH
    }
  }

  return null
}
