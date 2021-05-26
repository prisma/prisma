import slugify from '@sindresorhus/slugify'
import arg from 'arg'
import { AssertionError } from 'assert'
import chalk from 'chalk'
import execa from 'execa'
import fs from 'fs'
import fetch from 'node-fetch'

function branchToTag(branch: string): string {
  if (branch === 'master') {
    return 'latest'
  }

  if (isPatchBranch(branch)) {
    return 'patch'
  }

  return 'integration'
}

function isPatchBranch(version: string): boolean {
  return /^2\.(\d+)\.x/.test(version)
}

async function main(dryRun = false) {
  if (dryRun) {
    console.log(`Dry run`)
  }
  const clientPayload = JSON.parse(process.env.GITHUB_EVENT_CLIENT_PAYLOAD)
  assertIsClientPayload(clientPayload)

  const npmTag = branchToTag(clientPayload.branch)
  const maybeName =
    npmTag === 'integration' ? `${slugify(clientPayload.branch)}-` : ''
  const nextStable = await getNextStableVersion(npmTag === 'patch')
  const increment = await getVersionIncrement(nextStable)
  const newVersion = `${nextStable}-${increment}.${maybeName}${clientPayload.commit}`

  console.log(chalk.bold.greenBright('Going to publish:\n'))
  console.log(`${chalk.bold('Version')}  ${newVersion}`)
  console.log(`${chalk.bold('Tag')}      ${npmTag}\n`)

  adjustPkgJson('packages/engines-version/package.json', (pkg) => {
    pkg.prisma.enginesVersion = clientPayload.commit
    pkg.version = newVersion
  })

  adjustPkgJson('packages/engines/package.json', (pkg) => {
    pkg.version = newVersion
  })

  await run(
    'packages/engines-version',
    `pnpm publish --no-git-checks --tag ${npmTag}`,
    dryRun,
  )
  await run(
    'packages/engines',
    `pnpm i @prisma/engines-version@${newVersion}`,
    dryRun,
  )
  await run('packages/engines', `pnpm run build`, dryRun)
  await run(
    'packages/engines',
    `pnpm publish --no-git-checks --tag ${npmTag}`,
    dryRun,
  )
}

type ClientInput = {
  branch: string
  commit: string
}

function adjustPkgJson(pathToIt: string, cb: (pkg: any) => void) {
  const pkg = JSON.parse(fs.readFileSync(pathToIt, 'utf-8'))
  cb(pkg)
  fs.writeFileSync(pathToIt, JSON.stringify(pkg, null, 2))
}

// Sets the last bit of the version, the patch to 0
function setPatchZero(version: string): string {
  const [major, minor, patch] = version.split('.')
  return `${major}.${minor}.0`
}

async function getNextStableVersion(isPatch: boolean): Promise<string | null> {
  const data = await fetch('https://registry.npmjs.org/prisma').then((res) =>
    res.json(),
  )
  // We want a version scheme of `2.12.0` if the latest version is `2.11.5`
  // we're not interested in the patch - .5. That's why we remove it from the version
  const currentLatest: string = setPatchZero(data['dist-tags']?.latest)
  if (isPatch) {
    return incrementPatch(currentLatest)
  }
  return incrementMinor(currentLatest)
}

async function getVersionIncrement(versionPrefix: string): Promise<number> {
  console.log('getting increment for prefix', versionPrefix)
  const data = await fetch(
    'https://registry.npmjs.org/@prisma/engines-version',
  ).then((res) => res.json())
  const versions: string[] = Object.keys(data.versions).filter((v) =>
    v.startsWith(versionPrefix),
  )

  let max = 0

  // to match 2.10.0-123.asdasdasdja0s9dja0s9djas0d9j
  const regex = /\d\.\d+\.\d+-(\d+).\S+/
  for (const version of versions) {
    const match = regex.exec(version)
    if (match) {
      const n = Number(match[1])
      max = Math.max(max, n)
    }
  }
  console.log({ max })

  return max + 1
}

function assertIsClientPayload(val: any): asserts val is ClientInput {
  if (!val || typeof val !== 'object') {
    throw new AssertionError({
      message: 'client_payload is not an object',
      actual: val,
    })
  }
  if (!val.branch) {
    throw new AssertionError({
      message: 'branch missing in client_payload',
      actual: val,
    })
  }
  if (typeof val.branch !== 'string') {
    throw new AssertionError({
      message: 'branch must be a string in client_payload',
      actual: val,
    })
  }
  if (typeof val.commit !== 'string') {
    throw new AssertionError({
      message: 'commit must be a string in client_payload',
      actual: val,
    })
  }
  if (val.commit.length !== 'e078aa75c40550d826bc35aeee4f45582fb4165e'.length) {
    throw new AssertionError({
      message: 'commit is not a valid hash in client_payload',
      actual: val,
    })
  }
}

const semverRegex = /^(?<major>0|[1-9]\d*)\.(?<minor>0|[1-9]\d*)\.(?<patch>0|[1-9]\d*)(?:-(?<prerelease>(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+(?<buildmetadata>[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/

function incrementMinor(version: string): string | null {
  const match = semverRegex.exec(version)
  if (match) {
    return `${match.groups.major}.${Number(match.groups.minor) + 1}.${
      match.groups.patch
    }`
  }

  return null
}

function incrementPatch(version: string): string | null {
  const match = semverRegex.exec(version)
  if (match) {
    return `${match.groups.major}.${match.groups.minor}.${
      Number(match.groups.patch) + 1
    }`
  }

  return null
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
    })
  } catch (e) {
    throw new Error(
      chalk.red(
        `Error running ${chalk.bold(cmd)} in ${chalk.underline(cwd)}:`,
      ) + (e.stderr || e.stack || e.message),
    )
  }
}

// useful for debugging
// process.env.GITHUB_EVENT_CLIENT_PAYLOAD = JSON.stringify({
//   branch: 'napi/version-function',
//   commit: '4165db0d1bddd480461f721ad5447bb261727728',
// })

const args = arg({
  '--dry': Boolean,
})

main(args['--dry']).catch((e) => {
  console.error(e)
  process.exit(1)
})
