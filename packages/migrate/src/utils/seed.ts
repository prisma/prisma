import path from 'node:path'

import { loadConfigFromPackageJson } from '@prisma/config'
import Debug from '@prisma/debug'
import execa from 'execa'
import { bold, italic, red } from 'kleur/colors'

const debug = Debug('prisma:migrate:seed')

/**
 * User's Prisma configuration should live in `prisma.config.ts` instead of `package.json#prisma`.
 * See: https://pris.ly/prisma-config.
 * @deprecated
 */
export async function getSeedCommandFromPackageJson(cwd: string) {
  const prismaConfig = await loadConfigFromPackageJson(cwd)

  debug({ prismaConfig })

  if (!prismaConfig?.config?.seed) {
    return null
  }

  const seedCommandFromPkgJson = prismaConfig.config.seed

  // Validate if seed command is a string
  if (typeof seedCommandFromPkgJson !== 'string') {
    throw new Error(
      `Provided seed command \`${seedCommandFromPkgJson}\` from \`${path.relative(
        cwd,
        prismaConfig.loadedFromFile,
      )}\` must be of type string`,
    )
  }

  if (!seedCommandFromPkgJson) {
    throw new Error(
      `Provided seed command \`${seedCommandFromPkgJson}\` from \`${path.relative(
        cwd,
        prismaConfig.loadedFromFile,
      )}\` cannot be empty`,
    )
  }

  return prismaConfig.config.seed
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
