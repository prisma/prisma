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
import { promisify } from 'util'
import { cloneOrPull } from '../setup'

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

// if the current branch is ahead, we need to push it
async function getUnpushedCommitCount(dir: string): Promise<number> {
  const result = await runResult(dir, `git status --porcelain=v2 --branch`)
  const lines = result.split('\n')
  const abLine = lines.find((l) => l.startsWith('# branch.ab'))

  if (abLine) {
    const regex = /branch\.ab\s\+(\d+)/
    const match = regex.exec(abLine)
    if (match) {
      return Number(match[1])
    }
  }

  return 0
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
  messages: string[],
  dry = false,
): Promise<void> {
  await run(
    dir,
    `git commit -a ${messages.map((m) => `-m "${m}"`).join(' ')}`,
    dry,
  )
}

async function push(dir: string, dry = false): Promise<void> {
  const branch = await getBranch(dir)
  if (process.env.BUILDKITE) {
    if (!process.env.GITHUB_TOKEN) {
      throw new Error(`Missing env var GITHUB_TOKEN`)
    }
    const remotes = (await runResult(dir, `git remote`)).trim().split('\n')
    if (!remotes.includes('origin-push')) {
      await run(
        dir,
        `git remote add origin-push https://${process.env.GITHUB_TOKEN}@github.com/prisma/${dir}.git`,
        dry,
      )
    }
    await run(dir, `git push --quiet --set-upstream origin-push ${branch}`, dry)
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
): Promise<void> {
  const args = [chalk.underline('./' + cwd).padEnd(20), chalk.bold(cmd)]
  if (dry) {
    args.push(chalk.dim('(dry)'))
  }
  console.log(...args)
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

function getCommitMessages(dir: string, packages: Packages): string[] {
  const messages = Object.values(packages)
    .sort((a, b) => {
      if (['@prisma/client', 'prisma'].includes(a.name)) {
        return -1
      }

      if (['@prisma/client', 'prisma'].includes(b.name)) {
        return 1
      }

      return a.name < b.name ? -1 : 1
    })
    .filter((p) => p.path.startsWith(dir))
    .map((p) => `${p.name}@${p.version}`)

  if (messages.length > 0) {
    messages[messages.length - 1] += ' [skip ci]'
  }

  return messages
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

/**
 * Takes the max alpha version + 1
 * For now supporting 2.0.0-alpha.X
 * @param packages Local package definitions
 */
async function getNewAlphaVersion(packages: Packages): Promise<string> {
  const before = Date.now()
  console.log('\nCalculating new alpha version...')
  const versions = await getAllVersions(packages, 'alpha')
  const alphaVersions = getAlphaVersionIncrements(versions)
  const maxAlpha = Math.max(...alphaVersions)

  const version = `2.0.0-alpha.${maxAlpha + 1}`
  console.log(`Got ${version} in ${Date.now() - before}ms`)
  return version
}

async function getNewPatchBetaVersion(packages: Packages): Promise<string> {
  const versions = await getAllVersions(packages, 'patch-beta')
  const currentBeta = getBetaFromPatchBranch(process.env.PATCH_BRANCH)
  const increments = getPatchVersionIncrements(versions, currentBeta)
  const maxIncrement = Math.max(...increments, 0)

  return `2.0.0-beta.${currentBeta}-${maxIncrement + 1}`
}

function getAlphaVersionIncrements(versions: string[]): number[] {
  const regex = /2\.0\.0-alpha\.(\d+)/
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

function getPatchVersionIncrements(versions: string[], beta: string): number[] {
  const regex = /2\.0\.0-beta\.(\d+)-(\d+)/
  return versions
    .filter((v) => v.trim().length > 0)
    .map((v) => {
      const match = regex.exec(v)
      if (
        match &&
        match[1] === beta && // only if the current version is in there, we're interested
        match[2]
      ) {
        return Number(match[2])
      }
      return null
    })
    .filter((v) => v)
}

async function getAllVersions(
  packages: Packages,
  channel: string,
): Promise<string[]> {
  return flatten(
    await Promise.all(
      Object.values(packages).map(async (pkg) => {
        const pkgVersions = [pkg.version]
        const remoteVersion = await runResult(
          '.',
          `npm info ${pkg.name}@${channel} version`,
        )
        if (remoteVersion && remoteVersion.length > 0) {
          pkgVersions.push(remoteVersion)
        }

        return pkgVersions
      }),
    ),
  )
}

function getBetaFromPatchBranch(beta: string): string | null {
  const regex = /2\.0\.0-beta\.(\d+)\.x/
  const match = regex.exec(beta)

  if (match) {
    return match[1]
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

  if (!args['--test'] && !args['--publish'] && !args['--dry-run']) {
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
    if (!args['--release'].startsWith('2.0.0-beta.')) {
      throw new Error(
        `New release version ${chalk.bold.underline(
          args['--release'],
        )} does not follow the beta naming scheme: ${chalk.bold.underline(
          '2.0.0-beta.X',
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
    if (args['--release']) {
      prisma2Version = args['--release']
    } else if (process.env.PATCH_BRANCH) {
      // TODO Check if PATCH_BRANCH work!
      prisma2Version = await getNewPatchBetaVersion(packages)
    } else {
      prisma2Version = await getNewAlphaVersion(packages)
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

    if (!args['--dry-run'] && args['--test']) {
      console.log(chalk.bold('\nTesting packages'))
      await testPackages(packages, getPublishOrder(packages))
    }

    if (args['--publish'] || args['--dry-run']) {
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
        await run(
          '.',
          `pnpm update  -r @prisma/studio@${latestStudioVersion} @prisma/studio-transports@${latestStudioVersion} @prisma/studio-server@${latestStudioVersion} @prisma/studio-types@${latestStudioVersion}`,
        )
      }

      await publishPackages(
        packages,
        packagesWithVersions,
        getPublishOrder(packages),
        args['--dry-run'],
        prisma2Version,
        args['--release'],
      )

      try {
        await tagEnginesRepo(args['--dry-run'])
      } catch (e) {
        console.error(e)
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
  /** Get ready */
  await cloneOrPull('prisma-engines')
  const remotes = (await runResult('prisma-engines', `git remote`))
    .trim()
    .split('\n')

  if (!remotes.includes('origin-push')) {
    await run(
      'prisma-engines',
      `git remote add origin-push https://${process.env.GITHUB_TOKEN}@github.com/prisma/prisma-engines.git`,
      dryRun,
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

function patchVersion(version: string): string | null {
  // Thanks 🙏 to https://github.com/semver/semver/issues/232#issuecomment-405596809
  const regex = /^(?<major>0|[1-9]\d*)\.(?<minor>0|[1-9]\d*)\.(?<patch>0|[1-9]\d*)(?:-(?<prerelease>(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+(?<buildmetadata>[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/

  const match = regex.exec(version)
  if (match) {
    return `${match.groups.major}.${match.groups.minor}.${
      Number(match.groups.patch) + 1
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
      const tag = process.env.PATCH_BRANCH
        ? 'patch-beta'
        : prisma2Version.includes('alpha')
        ? 'alpha'
        : 'latest'
      const newVersion = prisma2Version

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
      if (process.env.BUILDKITE) {
        await run(pkgDir, `pnpm run build`, dryRun)
      }
      await run(pkgDir, `pnpm publish --tag ${tag}`, dryRun)
    }
  }

  if (process.env.UPDATE_STUDIO) {
    await run('.', `git config --global user.email "prismabots@gmail.com"`)
    await run('.', `git config --global user.name "prisma-bot"`)
  }

  // for now only push when studio is being updated
  if (!process.env.BUILDKITE || process.env.UPDATE_STUDIO) {
    const repo = '.'
    // commit and push it :)
    const messages = await getCommitMessages(repo, changedPackages)
    if (messages.length > 0) {
      // we try catch this, as this is not necessary for CI to succeed
      await run(repo, `git pull origin master --no-edit`)
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
          await commitChanges(repo, messages, dryRun)
        }
        const unpushedCommitCount = await getUnpushedCommitCount(repo)
        if (unpushedCommitCount === 0) {
          console.log(
            `${chalk.bold(
              'Skipping',
            )} pushing commits, as they're already pushed`,
          )
        } else {
          console.log(
            `There are ${unpushedCommitCount} unpushed local commits in ${chalk.cyanBright(
              `./`,
            )}`,
          )
          await push(repo, dryRun)
        }
      } catch (e) {
        console.error(e)
        console.error(`Ignoring this error, continuing`)
      }
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
