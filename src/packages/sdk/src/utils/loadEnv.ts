import { getSchemaPathFromPackageJsonSync } from '../cli/getSchema'
import { dotenvExpand } from '../dotenvExpand'
import arg from 'arg'
import chalk from 'chalk'
import debugLib from 'debug'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

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

export function tryLoadEnv(
  args: CLIArgs,
  opts: { cwd: string } = { cwd: process.cwd() },
): void {
  let envInfo: LoadEnvResult | null = null
  let schemaPathFromPkgJson: string | null = null

  // 1 -Check --schema directory
  if (args && args['--schema']) {
    envInfo = tryLoadEnvFromSchemaArgs(args['--schema'])
  }
  // 2 - Check package.json for `prisma.schema` configuration
  else if ((schemaPathFromPkgJson = readSchemaPathFromPkgJson()) !== null) {
    envInfo = tryLoadEnvFromPkgJson(schemaPathFromPkgJson, opts.cwd)
  }
  // 3 - Check ./prisma directory for schema.prisma
  else if (
    fs.existsSync('prisma/schema.prisma') &&
    fs.existsSync('prisma/.env')
  ) {
    // needed for Windows
    const relative = path.relative(opts.cwd, './prisma/.env')

    envInfo = {
      dotenvResult: dotenvExpand(dotenv.config({ path: 'prisma/.env' })),
      message: chalk.dim(`Environment variables loaded from ${relative}`),
    }
  }
  // 4 - Check current directory for schema.prisma
  else if (fs.existsSync('schema.prisma') && fs.existsSync('.env')) {
    envInfo = {
      dotenvResult: dotenvExpand(dotenv.config({ path: '.env' })),
      message: chalk.dim('Environment variables loaded from current directory'),
    }
  }
  // 5 - Check if ./prisma/.env exist and load it (we could not find a schema.prisma)
  else if (fs.existsSync('prisma/.env')) {
    // needed for Windows
    const relative = path.relative(opts.cwd, './prisma/.env')

    envInfo = {
      dotenvResult: dotenvExpand(dotenv.config({ path: 'prisma/.env' })),
      message: chalk.dim(`Environment variables loaded from ${relative}`),
    }
  }
  // 6 - We didn't find a .env file next to the prisma.schema file.
  else {
    debug('Environment variables not loaded')
  }

  // Print the error if any (if internal dotenv readFileSync throws)
  if (envInfo?.dotenvResult.error) {
    return console.error(
      chalk.redBright.bold('Error: ') + envInfo.dotenvResult.error,
    )
  }

  if (envInfo?.message && !process.env.PRISMA_GENERATE_IN_POSTINSTALL) {
    console.error(envInfo.message)
  }
}

function tryLoadEnvFromSchemaArgs(
  schemaPathFromArgs: string,
): LoadEnvResult | null {
  const dotenvFilepath = path.join(path.dirname(schemaPathFromArgs), '.env')

  if (!fs.existsSync(schemaPathFromArgs) || !fs.existsSync(dotenvFilepath)) {
    debug('Environment variables not loaded (--schema was provided)')
    return null
  }

  return {
    dotenvResult: dotenvExpand(dotenv.config({ path: dotenvFilepath })),
    message: chalk.dim(
      'Environment variables loaded from provided --schema directory',
    ),
  }
}

function readSchemaPathFromPkgJson(): string | null {
  try {
    return getSchemaPathFromPackageJsonSync(process.cwd())
  } catch {
    return null
  }
}

function tryLoadEnvFromPkgJson(
  schemaPath: string,
  cwd: string,
): LoadEnvResult | null {
  try {
    const dotenvFilepath = path.join(path.dirname(schemaPath), '.env')

    if (!fs.existsSync(schemaPath) || !fs.existsSync(dotenvFilepath)) {
      debug(
        'Environment variables not loaded (package.json configuration was provided)',
      )
      return null
    }

    // needed for Windows
    const relative = path.relative(cwd, dotenvFilepath)

    return {
      dotenvResult: dotenvExpand(dotenv.config({ path: dotenvFilepath })),
      message: chalk.dim(
        `Environment variables loaded from package.json configuration at ${relative}`,
      ),
    }
  } catch {
    debug(
      'Environment variables not loaded (package.json configuration was provided)',
    )
    return null
  }
}
