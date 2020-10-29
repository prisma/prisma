import arg from 'arg'
import chalk from 'chalk'
import debugLib from 'debug'
import dotenv from 'dotenv'
import findUp from 'find-up'
import fs from 'fs'
import path from 'path'
import { getSchemaPathFromPackageJsonSync } from '../cli/getSchema'
import { dotenvExpand } from '../dotenvExpand'

const debug = debugLib('loadEnv')

type CLIArgs =
  | Error
  | arg.Result<{
      '--schema': StringConstructor
      '--telemetry-information': StringConstructor
    }>

type DotenvResult = dotenv.DotenvConfigOutput & {
  ignoreProcessEnv?: boolean | undefined
}

interface LoadEnvResult {
  message: string
  path: string
  dotenvResult: DotenvResult
}
/**
 * Tries load env variables
 *  1. Load .env from project root
 *  1. Load first .env from possible schema locations and throw if there are env clashes with root .env
 *    1. Read location from schema arg --schema
 *    1. Read location from pkgJSON "prisma": {"schema": "/path/to/schema.prisma"}
 *    1. Read from default location ./prisma/.env
 */
export function tryLoadEnv(
  schemaPath?: string,
  opts: { cwd: string } = { cwd: process.cwd() },
) {
  const rootEnvInfo = loadEnvFromProjectRoot(opts)
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
  let schemaEnvInfo: LoadEnvResult | null = null
  for (const envPath of schemaEnvPaths) {
    // If the paths are the same then skip
    if (
      rootEnvInfo?.path &&
      envPath &&
      path.resolve(rootEnvInfo.path) === path.resolve(envPath)
    ) {
      continue
    }
    debug(`Searching in ${envPath}`)
    checkForConflicts(rootEnvInfo, envPath)
    schemaEnvInfo = loadEnv(envPath)
    if (schemaEnvInfo) break
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
  envPath: string | null,
) {
  const notTheSame =
    rootEnvInfo?.path &&
    envPath &&
    path.resolve(rootEnvInfo?.path) !== path.resolve(envPath)
  const parsedRootEnv = rootEnvInfo?.dotenvResult.parsed
  if (parsedRootEnv && envPath && notTheSame && fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath))
    const conflicts: string[] = []
    for (const k in envConfig) {
      if (parsedRootEnv[k] === envConfig[k]) {
        conflicts.push(k)
      }
    }
    if (conflicts.length > 0) {
      throw new Error(`
      You are trying to load env variables which are already present in your project root .env
      \tRoot: ${rootEnvInfo?.path}
      \tPrisma: ${envPath}
      \tEnv Conflicts:
      ${conflicts.map((conflict) => `\t\t${conflict}`).join('\n')}

      You can fix this by removing the .env file from "${envPath}" and move its contents to your .env file at the root "${
        rootEnvInfo?.path
      }"
      `)
    }
  }
}
function findRootPkg(opts: findUp.Options | undefined) {
  const pkgJson = findUp.sync((dir) => {
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
  return pkgJson
}
function loadEnvFromProjectRoot(opts: { cwd: string }) {
  const pkgJsonPath = findRootPkg(opts)
  const rootDir = pkgJsonPath && path.dirname(pkgJsonPath)
  const envPath = rootDir && path.join(rootDir, '.env')
  return loadEnv(envPath)
}
function loadEnv(envPath: string | null | undefined): LoadEnvResult | null {
  if (envPath && fs.existsSync(envPath)) {
    debug(`Environment variables loaded from ${envPath}`)
    return {
      dotenvResult: dotenvExpand(dotenv.config({ path: envPath })),
      message: chalk.dim(`Environment variables loaded from ${envPath}`),
      path: envPath,
    }
  }
  return null
}
function schemaPathToEnvPath(schemaPath: string | null | undefined) {
  if (!schemaPath) return null
  return path.join(path.dirname(schemaPath), '.env')
}
