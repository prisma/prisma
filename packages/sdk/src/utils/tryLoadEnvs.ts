import Debug from '@prisma/debug'
import chalk from 'chalk'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

import { dotenvExpand } from '../dotenvExpand'

const debug = Debug('prisma:tryLoadEnv')

type DotenvResult = dotenv.DotenvConfigOutput & {
  ignoreProcessEnv?: boolean | undefined
}

// non-exported type from dotenv
interface DotenvLoadEnvResult {
  message: string
  path: string
  dotenvResult: DotenvResult
}

// our type for loaded env data
export type LoadedEnv =
  | {
      message?: string
      parsed: {
        [x: string]: string
      }
    }
  | undefined

export function tryLoadEnvs(
  {
    rootEnvPath,
    schemaEnvPath,
  }: {
    rootEnvPath: string | null | undefined
    schemaEnvPath: string | null | undefined
  },
  opts: { conflictCheck: 'warn' | 'error' | 'none' } = {
    conflictCheck: 'none',
  },
): LoadedEnv {
  const rootEnvInfo = loadEnv(rootEnvPath)
  if (opts.conflictCheck !== 'none') {
    // This will throw an error if there are conflicts
    checkForConflicts(rootEnvInfo, schemaEnvPath, opts.conflictCheck)
  }
  // Only load the schema .env if it is not the same as root
  let schemaEnvInfo: DotenvLoadEnvResult | null = null
  if (!pathsEqual(rootEnvInfo?.path, schemaEnvPath)) {
    schemaEnvInfo = loadEnv(schemaEnvPath)
  }

  // We didn't find a .env file.
  if (!rootEnvInfo && !schemaEnvInfo) {
    debug('No Environment variables loaded')
  }

  // Print the error if any (if internal dotenv readFileSync throws)
  if (schemaEnvInfo?.dotenvResult.error) {
    return console.error(chalk.redBright.bold('Schema Env Error: ') + schemaEnvInfo.dotenvResult.error) as undefined
  }
  const messages = [rootEnvInfo?.message, schemaEnvInfo?.message].filter(Boolean)

  return {
    message: messages.join('\n'),
    parsed: {
      ...rootEnvInfo?.dotenvResult?.parsed,
      ...schemaEnvInfo?.dotenvResult?.parsed,
    },
  }
}
/**
 * Will throw an error if the file at `envPath` has env conflicts with `rootEnv`
 */
function checkForConflicts(
  rootEnvInfo: DotenvLoadEnvResult | null,
  envPath: string | null | undefined,
  type: 'warn' | 'error',
) {
  const parsedRootEnv = rootEnvInfo?.dotenvResult.parsed
  const areNotTheSame = !pathsEqual(rootEnvInfo?.path, envPath)
  if (parsedRootEnv && envPath && areNotTheSame && fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath))
    const conflicts: string[] = []
    for (const k in envConfig) {
      if (parsedRootEnv[k] === envConfig[k]) {
        conflicts.push(k)
      }
    }
    if (conflicts.length > 0) {
      // const message = `You are trying to load env variables which are already present in your project root .env
      const relativeRootEnvPath = path.relative(process.cwd(), rootEnvInfo!.path)
      const relativeEnvPath = path.relative(process.cwd(), envPath)
      if (type === 'error') {
        const message = `There is a conflict between env var${conflicts.length > 1 ? 's' : ''} in ${chalk.underline(
          relativeRootEnvPath,
        )} and ${chalk.underline(relativeEnvPath)}
Conflicting env vars:
${conflicts.map((conflict) => `  ${chalk.bold(conflict)}`).join('\n')}

We suggest to move the contents of ${chalk.underline(relativeEnvPath)} to ${chalk.underline(
          relativeRootEnvPath,
        )} to consolidate your env vars.\n`
        throw new Error(message)
      } else if (type === 'warn') {
        const message = `Conflict for env var${conflicts.length > 1 ? 's' : ''} ${conflicts
          .map((c) => chalk.bold(c))
          .join(', ')} in ${chalk.underline(relativeRootEnvPath)} and ${chalk.underline(relativeEnvPath)}
Env vars from ${chalk.underline(relativeEnvPath)} overwrite the ones from ${chalk.underline(relativeRootEnvPath)}
      `
        console.warn(`${chalk.yellow('warn(prisma)')} ${message}`)
      }
    }
  }
}

export function loadEnv(envPath: string | null | undefined): DotenvLoadEnvResult | null {
  if (exists(envPath)) {
    debug(`Environment variables loaded from ${envPath}`)

    return {
      dotenvResult: dotenvExpand(
        dotenv.config({
          path: envPath,
          // Useful to debug dotenv parsing, prints errors & warnings
          // Set to any value to enable
          // Example for empty .env file
          // [dotenv][DEBUG] did not match key and value when parsing line 1:
          //
          // Value needs to be null or undefined, false is truthy
          // https://github.com/motdotla/dotenv/blob/7301ac9be0b2c766f865bbe24280bf82586d25aa/lib/main.js#L89-L91
          debug: process.env.DOTENV_CONFIG_DEBUG ? true : undefined,
        }),
      ),
      message: chalk.dim(`Environment variables loaded from ${path.relative(process.cwd(), envPath)}`),
      path: envPath,
    }
  } else {
    debug(`Environment variables not found at ${envPath}`)
  }
  return null
}
export function pathsEqual(path1: string | null | undefined, path2: string | null | undefined) {
  return path1 && path2 && path.resolve(path1) === path.resolve(path2)
}

export function exists(p: string | null | undefined): p is string {
  return Boolean(p && fs.existsSync(p))
}
