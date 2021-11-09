import execa from 'execa'
import chalk from 'chalk'
import path from 'path'
import pRetry from 'p-retry'
import pMap from 'p-map'
import {
  getPackages,
  getPublishOrder,
  getPackageDependencies,
} from './ci/publish'
import fetch from 'node-fetch'

async function main() {
  const buildOnly = process.argv[2] === '--build'

  if (process.env.BUILDKITE_TAG && !process.env.RELEASE_PROMOTE_DEV) {
    throw new Error(`When providing BUILDKITE_TAG, you also need to provide the env var RELEASE_PROMOTE_DEV, which
has to point to the dev version you want to promote, for example 2.1.0-dev.123`)
  }
  if (process.env.RELEASE_PROMOTE_DEV && !process.env.BUILDKITE_TAG) {
    throw new Error(
      `You provided RELEASE_PROMOTE_DEV without BUILDKITE_TAG, which doesn't make sense.`,
    )
  }
  if (process.env.CI && !process.env.SKIP_GIT) {
    await run('.', `git config --global user.email "prismabots@gmail.com"`)
    await run('.', `git config --global user.name "prisma-bot"`)
  }
  if (process.env.RELEASE_PROMOTE_DEV) {
    // Checkout exactly the commit of the `dev` version that is being promoted/released
    
    const prismaCommit = await getPrismaCommitFromPackageJsonViaUnpkg(process.env.RELEASE_PROMOTE_DEV)
    // TODO: disable the dry run here // TODO 2: What does this mean?

    await run(`.`, `git stash`)
    await run(`.`, `git checkout ${prismaCommit}`, true)
  } else if (process.env.PATCH_BRANCH) {
    await checkoutPatchBranches(process.env.PATCH_BRANCH)
    console.log(`Commit we're on:`)
    await execa.command('git rev-parse HEAD', {
      stdio: 'inherit',
    })
  } else if (process.env.UPDATE_STUDIO) {
    await execa.command(`git stash`, {
      stdio: 'inherit',
    })
    await execa.command(`git checkout ${process.env.BUILDKITE_BRANCH}`, {
      stdio: 'inherit',
    })
  }

  const rawPackages = await getPackages()
  const packages = getPackageDependencies(rawPackages)
  const publishOrder = getPublishOrder(packages)

  console.log(publishOrder)
  if (!buildOnly) {
    console.debug(`Installing dependencies`)

    await run(
      '.',
      `pnpm i --no-prefer-frozen-lockfile --reporter=silent`,
    ).catch(() => {})
  }

  console.debug(`Building packages`)

  for (const batch of publishOrder) {
    await pMap(
      batch,
      async (pkgName) => {
        const pkg = packages[pkgName]
        const pkgDir = path.dirname(pkg.path)
        const runPromise = run(pkgDir, 'pnpm run build')

        // we want to build all in build-only to see all errors at once
        if (buildOnly) {
          runPromise.catch(console.error)

          // for sqlite3 native bindings, they need a rebuild after an update
          if (
            ['@prisma/migrate', '@prisma/integration-tests'].includes(pkgName)
          ) {
            await run(pkgDir, 'pnpm rebuild')
          }
        }

        await runPromise
      },
      { concurrency: 1 },
    )
  }

  if (buildOnly) {
    return
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
    }
  }

  // final install on top level
  await pRetry(
    async () => {
      await run('.', 'pnpm i --no-prefer-frozen-lockfile')
    },
    {
      retries: 6,
      onFailedAttempt: (e) => {
        console.error(e)
      },
    },
  )
}

if (!module.parent) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}

export async function run(
  cwd: string,
  cmd: string,
  dry = false,
): Promise<execa.ExecaReturnValue<string> | undefined> {
  const args = [chalk.underline('./' + cwd).padEnd(20), chalk.bold(cmd)]
  if (dry) {
    args.push(chalk.dim('(dry)'))
  }
  console.debug(args.join(' '))
  if (dry) {
    return
  }
  try {
    return await execa.command(cmd, {
      cwd,
      stdio: 'inherit',
    })
  } catch (_e) {
    const e = _e as execa.ExecaError
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
  } catch (_e) {
    const e = _e as execa.ExecaError
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
    // TODO enable
    // const tag = getTagFromPatchBranch(patchBranch)
    // console.log(
    //   `Patch branch ${patchBranch} is getting checked out from tag ${tag}`,
    // )
    // await run(repoPath, `git checkout -b ${patchBranch} ${tag}`)

    // TODO: For the current 2.1.1 patch we need this, as otherwise our updated publish script wouldn't be part of this
    await run(repoPath, `git checkout -b ${patchBranch}`)
  }
}

// Unused
// function getTagFromPatchBranch(patchBranch: string): string {
//   const [major, minor, patch] = patchBranch.split('.')
//   return `${major}.${minor}.0`
// }

async function branchExists(dir: string, branch: string): Promise<boolean> {
  const output = await runResult(dir, `git branch --list ${branch}`)
  const exists = output.trim().length > 0
  if (exists) {
    console.log(`Branch exists: ${exists}`)
  }
  return exists
}

async function getPrismaCommitFromPackageJsonViaUnpkg(
  npmVersion: string,
): Promise<{ prisma: string }> {
  return fetch(`https://unpkg.com/prisma@${npmVersion}/package.json`, {
    headers: {
      accept: 'application/json',
    },
  })
    .then((res) => res.json())
    .then((pkg) => {
      return pkg.prisma.prismaCommit
    })
}
