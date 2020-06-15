import execa from 'execa'
import chalk from 'chalk'
import Debug from 'debug'
import fs from 'fs'
import path from 'path'
import pMap from 'p-map'
import {
  getPackages,
  getPublishOrder,
  getPackageDependencies,
} from './ci/publish'
Debug.enable('setup')
const debug = Debug('setup')

function getCommitEnvVar(name: string): string {
  return `${name.toUpperCase().replace(/-/g, '_')}_COMMIT`
}

async function main() {
  if (process.env.PATCH_BRANCH) {
    await checkoutPatchBranches(process.env.PATCH_BRANCH)
    // return
  }

  debug(`Installing dependencies, building packages`)

  const rawPackages = await getPackages()
  const packages = getPackageDependencies(rawPackages)
  const publishOrder = getPublishOrder(packages)

  console.log(publishOrder)

  await run(
    '.',
    `pnpm i --no-prefer-frozen-lockfile -r --ignore-scripts`,
  ).catch((e) => {})
  for (const batch of publishOrder) {
    await pMap(batch, async (pkgName) => {
      const pkg = packages[pkgName]
      const pkgDir = path.dirname(pkg.path)
      await run(pkgDir, 'pnpm run build')
    })
  }

  // this should not be necessary, it's an pnpm bug
  // it doesn't execute postinstall correctly
  for (const batch of publishOrder) {
    for (const pkgName of batch) {
      const pkg = packages[pkgName]
      if (pkg.packageJson.scripts.postinstall) {
        const pkgDir = path.dirname(pkg.path)
        await run(pkgDir, 'pnpm run postinstall')
      }
      if (pkg.packageJson.scripts.download) {
        const pkgDir = path.dirname(pkg.path)
        await run(pkgDir, 'pnpm run download')
      }
      if (pkg.packageJson.scripts['ncc:download']) {
        const pkgDir = path.dirname(pkg.path)
        await run(pkgDir, 'pnpm run ncc:download')
      }
    }
  }

  // final install on top level
  await run('.', 'pnpm i --no-prefer-frozen-lockfile -r')
}

if (!module.parent) {
  main().catch(console.error)
}

export async function cloneOrPull(repo: string, dryRun = false) {
  if (fs.existsSync(path.join(__dirname, '../', repo))) {
    return run(repo, `git pull origin master`, dryRun)
  } else {
    await run('.', `git clone --depth=50 ${repoUrl(repo)}`, dryRun)
    const envVar = getCommitEnvVar(repo)
    if (process.env[envVar]) {
      await run(repo, `git checkout ${process.env[envVar]}`, dryRun)
    }
  }
}

function repoUrl(repo: string, org: string = 'prisma') {
  return `https://github.com/${org}/${repo}.git`
}

export async function run(
  cwd: string,
  cmd: string,
  dry: boolean = false,
): Promise<void> {
  const args = [chalk.underline('./' + cwd).padEnd(20), chalk.bold(cmd)]
  if (dry) {
    args.push(chalk.dim('(dry)'))
  }
  debug(args.join(' '))
  if (dry) {
    return
  }
  try {
    await execa.command(cmd, {
      cwd,
      stdio: 'inherit',
    })
  } catch (e) {
    throw new Error(
      chalk.bold.red(
        `Error running ${chalk.bold(cmd)} in ${chalk.underline(cwd)}:`,
      ) + (e.stack || e.message),
    )
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

async function checkoutPatchBranches(patchBranch: string) {
  const repoPath = path.join(__dirname, '../../')
  if (await branchExists(repoPath, patchBranch)) {
    await run(repoPath, `git checkout ${patchBranch}`)
  } else {
    await run(repoPath, `git checkout -b ${patchBranch}`)
  }
}

async function branchExists(dir: string, branch: string): Promise<boolean> {
  const output = await runResult(dir, `git branch --list ${branch}`)
  return output.trim().length > 0
}
