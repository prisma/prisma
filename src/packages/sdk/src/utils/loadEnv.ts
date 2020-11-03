import chalk from 'chalk'
import debugLib from 'debug'
import dotenv from 'dotenv'
import findUp from 'find-up'
import fs from 'fs'
import path from 'path'
import { getSchemaPathFromPackageJsonSync } from '../cli/getSchema'
import { dotenvExpand } from '../dotenvExpand'

const debug = debugLib('loadEnv')

type DotenvResult = dotenv.DotenvConfigOutput & {
  ignoreProcessEnv?: boolean | undefined
}
interface LoadEnvResult {
  message: string
  path: string
  dotenvResult: DotenvResult
}
/**
 *  1. Search in project root
 *  1. Schema
 *    1. Search location from schema arg --schema
 *    1. Search location from pkgJSON `"prisma": {"schema": "/path/to/schema.prisma"}`
 *    1. Search default location `./prisma/.env`
 *    1. Search cwd `./.env`
 *
 * @returns `{ rootEnvPath, schemaEnvPath }`
 */
export function getEnvPaths(
  schemaPath?: string | null,
  opts: { cwd: string } = { cwd: process.cwd() },
) {
  const rootEnvPath = getProjectRootEnvPath({ cwd: opts.cwd }) ?? null
  const schemaEnvPathFromArgs = schemaPathToEnvPath(schemaPath)
  const schemaEnvPathFromPkgJson = schemaPathToEnvPath(
    readSchemaPathFromPkgJson(),
  )
  const schemaEnvPaths = [
    schemaEnvPathFromArgs, // 1 - Check --schema directory for .env
    schemaEnvPathFromPkgJson, // 2 - Check package.json schema directory for .env
    './prisma/.env', // 3 - Check ./prisma directory for .env
    './.env', // 4 - Check cwd for .env
  ]
  const schemaEnvPath = schemaEnvPaths.find(exists)
  return { rootEnvPath, schemaEnvPath }
}

export function tryLoadEnvs(
  {
    rootEnvPath,
    schemaEnvPath,
  }: { rootEnvPath: string | null | undefined; schemaEnvPath: string | null | undefined},
  opts: { conflictCheck: 'warn' | 'error' | 'none' } = {
    conflictCheck: 'none',
  },
) {
  const rootEnvInfo = loadEnv(rootEnvPath)
  if (opts.conflictCheck !== 'none') {
    // This will throw an error if there are conflicts
    checkForConflicts(rootEnvInfo, schemaEnvPath, opts.conflictCheck)
  }
  // Only load the schema .env if it is not the same as root
  const areNotTheSame = !isSame(rootEnvInfo?.path, schemaEnvPath)
  let schemaEnvInfo: LoadEnvResult | null = null;
  if(areNotTheSame){
    schemaEnvInfo = loadEnv(schemaEnvPath)
  }

  // We didn't find a .env file.
  if (!rootEnvInfo && !schemaEnvInfo) {
    debug('No Environment variables loaded')
  }

  // Print the error if any (if internal dotenv readFileSync throws)
  if (schemaEnvInfo?.dotenvResult.error) {
    return console.error(
      chalk.redBright.bold('Schema Env Error: ') +
        schemaEnvInfo.dotenvResult.error,
    )
  }
  const messages = [rootEnvInfo?.message, schemaEnvInfo?.message].filter(
    Boolean,
  )

  return {
    message: messages.join('\n'),
    parsed: {
      ...rootEnvInfo?.dotenvResult?.parsed,
      ...schemaEnvInfo?.dotenvResult?.parsed,
    },
  }
}

function readSchemaPathFromPkgJson(): string | null {
  try {
    return getSchemaPathFromPackageJsonSync(process.cwd())
  } catch {
    return null
  }
}

/**
 * Will throw an error if the file at `envPath` has env conflicts with `rootEnv`
 */
function checkForConflicts(
  rootEnvInfo: LoadEnvResult | null,
  envPath: string | null | undefined,
  type: 'warn' | 'error'
) {
  const parsedRootEnv = rootEnvInfo?.dotenvResult.parsed
  const areNotTheSame = !isSame(rootEnvInfo?.path, envPath)
  if (parsedRootEnv && envPath && areNotTheSame && fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath))
    const conflicts: string[] = []
    for (const k in envConfig) {
      if (parsedRootEnv[k] === envConfig[k]) {
        conflicts.push(k)
      }
    }
    if (conflicts.length > 0) {
      const message = `
      You are trying to load env variables which are already present in your project root .env
      \tRoot: ${rootEnvInfo?.path}
      \tPrisma: ${envPath}
      \tEnv Conflicts:
      ${conflicts.map((conflict) => `\t\t${conflict}`).join('\n')}

      You can fix this by removing the .env file from "${envPath}" and move its contents to your .env file at the root "${
        rootEnvInfo?.path
      }"
      `
      if(type ==='error'){
        throw new Error(message)
      } else if(type === 'warn') {
        console.warn(message);
      }
    }
  }
}
function getProjectRootEnvPath(opts: findUp.Options | undefined) {
  const pkgJsonPath = findUp.sync((dir) => {
    const pkgPath = path.join(dir, 'package.json')
    if (findUp.exists(pkgPath)) {
      try {
        let pkg = require(pkgPath)
        if (pkg['name'] !== '.prisma/client') {
          return pkgPath
        }
      } catch (e) {
        debug(e)
      }
    }
  }, opts)

  const projectRootDir = pkgJsonPath && path.dirname(pkgJsonPath)
  return projectRootDir && path.join(projectRootDir, '.env')
}
function isSame(
  path1: string | null | undefined,
  path2: string | null | undefined,
) {
  return path1 && path2 && path.resolve(path1) === path.resolve(path2)
}
function exists(p: string | null | undefined): p is string {
  return Boolean(p && fs.existsSync(p))
}

export function loadEnv(
  envPath: string | null | undefined,
): LoadEnvResult | null {
  if (exists(envPath)) {
    debug(`Environment variables loaded from ${envPath}`)
    return {
      dotenvResult: dotenvExpand(dotenv.config({ path: envPath })),
      message: chalk.dim(
        `Environment variables loaded from ${path.resolve(envPath)}`,
      ),
      path: envPath,
    }
  } else {
    debug(`Environment variables not found at ${envPath}`)
  }
  return null
}
function schemaPathToEnvPath(schemaPath: string | null | undefined) {
  if (!schemaPath) return null
  return path.join(path.dirname(schemaPath), '.env')
}
