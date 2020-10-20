import arg from 'arg'
import chalk from 'chalk'
import debugLib from 'debug'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import readPkgUp from 'read-pkg-up'
import { getSchemaPathFromPackageJsonSync } from '../cli/getSchema'
import { dotenvExpand } from '../dotenvExpand'

const debug = debugLib('loadEnv')

type CLIArgs =
  | Error
  | arg.Result<{
      '--schema': StringConstructor
      '--telemetry-information': StringConstructor
    }>

interface DotenvResult {
  error?: Error
  parsed?: {
    [name: string]: string
  }
}

interface LoadEnvResult {
  message: string
  dotenvResult: DotenvResult
}
/**
 * Tries load env variables
 * 1. Checks schema dir
 *    1. From --schema arg
 *    2. PackageJSON schema config
 *    3. Default Prisma Dir `./prisma`
 */
export function tryLoadEnv(
  args: CLIArgs,
  opts: { cwd: string } = { cwd: process.cwd() },
): void {
  const rootEnvInfo = loadEnvFromProjectRoot(opts)
  const schemaPathFromArgs = schemaPathToEnvPath(args['--schema'])
  const schemaPathFromPkgJson = schemaPathToEnvPath(readSchemaPathFromPkgJson())

  const schemaPaths = [
    schemaPathFromArgs, // 1 -Check --schema directory
    schemaPathFromPkgJson, // 2 - Check package.json for `prisma.schema` configuration
    path.relative(opts.cwd, './prisma/.env'), // 3 - Check ./prisma directory for schema.prisma
  ]
  let schemaEnvInfo: LoadEnvResult | null = null
  for (const envPath of schemaPaths) {
    checkForConflicts(rootEnvInfo?.dotenvResult.parsed, envPath)
    schemaEnvInfo = loadEnv(envPath)
    if (schemaEnvInfo) break
  }

  // 6 - We didn't find a .env file next to the prisma.schema file.
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

  if (schemaEnvInfo?.message && !process.env.PRISMA_GENERATE_IN_POSTINSTALL) {
    console.error(schemaEnvInfo.message)
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
 * Will throw an error if the file at `envPath` has env conflicts with `parsedEnv`
 */
function checkForConflicts(
  parsedEnv: dotenv.DotenvParseOutput | undefined,
  envPath: string | null,
) {
  if (parsedEnv && envPath && fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath))
    const conflicts: string[] = []
    for (const k in envConfig) {
      if (parsedEnv.env[k] === envConfig[k]) {
        conflicts.push(k)
      }
    }
    if (conflicts.length > 0) {
      throw new Error(`
      You are trying to load duplicate env variables which are already present
      Path: ${path}
      Duplicates:
      ${conflicts.forEach((conflict) => `\t${conflict}`)} 
      `)
    }
  }
}

function loadEnvFromProjectRoot(opts: { cwd: string }) {
  const pkgJson = readPkgUp.sync({ cwd: opts.cwd })
  const rootDir = pkgJson?.path && path.dirname(pkgJson?.path)
  const envPath = rootDir && path.join(rootDir, '.env')
  return loadEnv(envPath)
}
function loadEnv(envPath: string | null | undefined) {
  if (envPath && fs.existsSync(envPath)) {
    debug(`Environment variables loaded from ${envPath}`)
    return {
      dotenvResult: dotenvExpand(dotenv.config({ path: envPath })),
      message: chalk.dim(
        `Environment variables loaded from ${path.resolve(envPath)}`,
      ),
    }
  }
  return null
}
function schemaPathToEnvPath(schemaPath: string | null) {
  if (!schemaPath) return null
  return path.join(path.dirname(schemaPath), '.env')
}
