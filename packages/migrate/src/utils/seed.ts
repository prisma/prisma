import Debug from '@prisma/debug'
import { getPrismaConfigFromPackageJson } from '@prisma/internals'
import execa from 'execa'
import { bold, italic, red } from 'kleur/colors'
import path from 'path'

const debug = Debug('prisma:migrate:seed')

export async function getSeedCommandFromPackageJson(cwd: string) {
  const prismaConfig = await getPrismaConfigFromPackageJson(cwd)

  debug({ prismaConfig })

  if (!prismaConfig || !prismaConfig.data?.seed) {
    return null
  }

  const seedCommandFromPkgJson = prismaConfig.data.seed

  // Validate if seed command is a string
  if (typeof seedCommandFromPkgJson !== 'string') {
    throw new Error(
      `Provided seed command \`${seedCommandFromPkgJson}\` from \`${path.relative(
        cwd,
        prismaConfig.packagePath,
      )}\` must be of type string`,
    )
  }

  if (!seedCommandFromPkgJson) {
    throw new Error(
      `Provided seed command \`${seedCommandFromPkgJson}\` from \`${path.relative(
        cwd,
        prismaConfig.packagePath,
      )}\` cannot be empty`,
    )
  }

  return seedCommandFromPkgJson
}

export async function executeSeedCommand({
  commandFromConfig,
  extraArgs,
}: {
  commandFromConfig: string
  extraArgs?: string
}): Promise<boolean> {
  // extraArgs can be passed in `DbSeed.ts` for the extra args after a -- separator
  // Example: db seed -- --custom-arg
  // Then extraArgs will be '--custom-arg'
  const command = extraArgs ? `${commandFromConfig} ${extraArgs}` : commandFromConfig
  process.stdout.write(`Running seed command \`${italic(command)}\` ...\n`)

  try {
    await execa.command(command, {
      stdout: 'inherit',
      stderr: 'inherit',
    })
  } catch (_e) {
    const e = _e as execa.ExecaError
    debug({ e })
    console.error(bold(red(`\nAn error occurred while running the seed command:`)))
    console.error(red(e.stderr || String(e)))
    return false
  }

  return true
}
