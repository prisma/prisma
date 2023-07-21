import Debug from '@prisma/debug'
import dotenv, { DotenvParseOutput } from 'dotenv'
import fs from 'fs'
import { bold, dim, underline, yellow } from 'kleur/colors'
import path from 'path'

import { dotenvExpand } from '../dotenvExpand'

const debug = Debug('prisma:tryLoadEnv')

type LoadEnvResult = {
  dotenvResult: dotenv.DotenvParseOutput | undefined
  message: string
  path: string
} | null

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
  let schemaEnvInfo: LoadEnvResult = null
  if (!pathsEqual(rootEnvInfo?.path, schemaEnvPath)) {
    schemaEnvInfo = loadEnv(schemaEnvPath)
  }

  // We didn't find a .env file.
  if (!rootEnvInfo && !schemaEnvInfo) {
    debug('No Environment variables loaded')
  }

  const messages = [rootEnvInfo?.message, schemaEnvInfo?.message].filter(Boolean)

  return {
    message: messages.join('\n'),
    parsed: {
      ...rootEnvInfo?.dotenvResult,
      ...schemaEnvInfo?.dotenvResult,
    },
  }
}
/**
 * Will throw an error if the file at `envPath` has env conflicts with `rootEnv`
 */
function checkForConflicts(rootEnvInfo: LoadEnvResult, envPath: string | null | undefined, type: 'warn' | 'error') {
  const parsedRootEnv = rootEnvInfo?.dotenvResult
  const areNotTheSame = !pathsEqual(rootEnvInfo?.path, envPath)

  if (parsedRootEnv && envPath && areNotTheSame && fs.existsSync(envPath)) {
    const dotenvContents = fs.readFileSync(envPath, 'utf-8')
    const envConfig = parseDotEnvContents(dotenvContents)

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
        const message = `There is a conflict between env var${conflicts.length > 1 ? 's' : ''} in ${underline(
          relativeRootEnvPath,
        )} and ${underline(relativeEnvPath)}
Conflicting env vars:
${conflicts.map((conflict) => `  ${bold(conflict)}`).join('\n')}

We suggest to move the contents of ${underline(relativeEnvPath)} to ${underline(
          relativeRootEnvPath,
        )} to consolidate your env vars.\n`
        throw new Error(message)
      } else if (type === 'warn') {
        const message = `Conflict for env var${conflicts.length > 1 ? 's' : ''} ${conflicts
          .map((c) => bold(c))
          .join(', ')} in ${underline(relativeRootEnvPath)} and ${underline(relativeEnvPath)}
Env vars from ${underline(relativeEnvPath)} overwrite the ones from ${underline(relativeRootEnvPath)}
      `
        console.warn(`${yellow('warn(prisma)')} ${message}`)
      }
    }
  }
}

export function loadEnv(envPath: string | null | undefined): LoadEnvResult {
  if (exists(envPath)) {
    const dotenvContents = fs.readFileSync(envPath, 'utf-8')

    debug(`Environment variables loaded from ${envPath}`)

    return {
      dotenvResult: parseDotEnvContents(dotenvContents),
      message: dim(`Environment variables loaded from ${path.relative(process.cwd(), envPath)}`),
      path: envPath,
    }
  } else {
    debug(`Environment variables not found at ${envPath}`)
  }
  return null
}

function parseDotEnvContents(dotenvContents: string): DotenvParseOutput | undefined {
  const parsed = dotenv.parse(dotenvContents)
  const expanded = dotenvExpand({ parsed, ignoreProcessEnv: true })
  return expanded.parsed
}

export function pathsEqual(path1: string | null | undefined, path2: string | null | undefined) {
  return path1 && path2 && path.resolve(path1) === path.resolve(path2)
}

export function exists(p: string | null | undefined): p is string {
  return Boolean(p && fs.existsSync(p))
}
