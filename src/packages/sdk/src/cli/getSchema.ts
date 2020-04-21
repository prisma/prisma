import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import execa from 'execa'

const exists = promisify(fs.exists)
const readFile = promisify(fs.readFile)

/**
 * Async
 */

export async function getSchemaPath(
  schemaPathFromArgs?,
): Promise<string | null> {
  if (schemaPathFromArgs) {
    // try the user custom path
    const customSchemaPath = await getAbsoluteSchemaPath(
      path.resolve(schemaPathFromArgs),
    )
    if (customSchemaPath) {
      return customSchemaPath
    } else {
      throw new Error(
        `Provided --schema at ${schemaPathFromArgs} doesn't exist.`,
      )
    }
  }

  // try the normal cwd
  const relativeSchemaPath = await getRelativeSchemaPath(process.cwd())
  if (relativeSchemaPath) {
    return relativeSchemaPath
  }

  // in case no schema can't be found there, try the npm-based INIT_CWD
  if (process.env.INIT_CWD) {
    return (
      (await getRelativeSchemaPath(process.env.INIT_CWD)) ||
      (await resolveYarnSchema())
    )
  }

  return null
}

async function resolveYarnSchema(): Promise<null | string> {
  if (process.env.npm_config_user_agent?.includes('yarn')) {
    try {
      const { stdout: version } = await execa.command('yarn --version')

      if (version.startsWith('2')) {
        return null
      }

      const { stdout } = await execa.command('yarn workspaces info --json')
      const json = getJson(stdout)
      for (const workspace of Object.values<any>(json)) {
        const workspacePath = path.join(
          process.env.INIT_CWD!,
          workspace.location,
        )
        const workspaceSchemaPath = await getRelativeSchemaPath(workspacePath)
        if (workspaceSchemaPath) {
          return workspaceSchemaPath
        }
      }
    } catch (e) {
      return null
    }
  }
  return null
}

function resolveYarnSchemaSync(): string | null {
  if (process.env.npm_config_user_agent?.includes('yarn')) {
    try {
      const { stdout: version } = execa.commandSync('yarn --version')

      if (version.startsWith('2')) {
        return null
      }

      const { stdout } = execa.commandSync('yarn workspaces info --json')
      const json = getJson(stdout)
      for (const workspace of Object.values<any>(json)) {
        const workspacePath = path.join(
          process.env.INIT_CWD!,
          workspace.location,
        )
        const workspaceSchemaPath = getRelativeSchemaPathSync(workspacePath)
        if (workspaceSchemaPath) {
          return workspaceSchemaPath
        }
      }
    } catch (e) {
      return null
    }
  }
  return null
}

async function getAbsoluteSchemaPath(
  schemaPath: string,
): Promise<string | null> {
  if (await exists(schemaPath)) {
    return schemaPath
  }

  return null
}

async function getRelativeSchemaPath(cwd: string): Promise<string | null> {
  let schemaPath = path.join(cwd, 'schema.prisma')
  if (await exists(schemaPath)) {
    return schemaPath
  }

  schemaPath = path.join(cwd, `prisma/schema.prisma`)

  if (await exists(schemaPath)) {
    return schemaPath
  }

  return null
}

/**
 * Small helper that returns the directory which contains the `schema.prisma` file
 */
export async function getSchemaDir(
  schemaPathFromArgs?,
): Promise<string | null> {
  if (schemaPathFromArgs) {
    return path.resolve(path.dirname(schemaPathFromArgs))
  }

  const schemaPath = await getSchemaPath(schemaPathFromArgs)
  if (schemaPath) {
    return path.dirname(schemaPath)
  }

  return null
}

export async function getSchema(schemaPathFromArgs?): Promise<string> {
  const schemaPath = await getSchemaPath(schemaPathFromArgs)

  if (!schemaPath) {
    throw new Error(`Could not find ${schemaPathFromArgs || 'schema.prisma'}`)
  }

  return readFile(schemaPath, 'utf-8')
}

/**
 * Sync
 */

export function getSchemaPathSync(schemaPathFromArgs?): string | null {
  if (schemaPathFromArgs) {
    // try the user custom path
    const customSchemaPath = getAbsoluteSchemaPathSync(
      path.resolve(schemaPathFromArgs),
    )
    if (customSchemaPath) {
      return customSchemaPath
    } else {
      throw new Error(
        `Provided --schema at ${schemaPathFromArgs} doesn't exist.`,
      )
    }
  }

  // first try intuitive schema path
  const relativeSchemaPath = getRelativeSchemaPathSync(process.cwd())

  if (relativeSchemaPath) {
    return relativeSchemaPath
  }

  // in case the normal schema path doesn't exist, try the npm base dir
  if (process.env.INIT_CWD) {
    return (
      getRelativeSchemaPathSync(process.env.INIT_CWD) || resolveYarnSchemaSync()
    )
  }

  return null
}

function getAbsoluteSchemaPathSync(schemaPath: string): string | null {
  if (fs.existsSync(schemaPath)) {
    return schemaPath
  }

  return null
}

function getRelativeSchemaPathSync(cwd: string): string | null {
  let schemaPath = path.join(cwd, 'schema.prisma')

  if (fs.existsSync(schemaPath)) {
    return schemaPath
  }

  schemaPath = path.join(cwd, `prisma/schema.prisma`)

  if (fs.existsSync(schemaPath)) {
    return schemaPath
  }

  return null
}

/**
 * Sync version of the small helper that returns the directory which contains the `schema.prisma` file
 */
export function getSchemaDirSync(schemaPathFromArgs?): string | null {
  if (schemaPathFromArgs) {
    return path.resolve(path.dirname(schemaPathFromArgs))
  }

  const schemaPath = getSchemaPathSync(schemaPathFromArgs)
  if (schemaPath) {
    return path.dirname(schemaPath)
  }

  return null
}

export function getSchemaSync(schemaPathFromArgs?): string {
  const schemaPath = getSchemaPathSync(schemaPathFromArgs)

  if (!schemaPath) {
    throw new Error(`Could not find ${schemaPath || 'schema.prisma'}`)
  }

  return fs.readFileSync(schemaPath, 'utf-8')
}

function getJson(stdout: string): any {
  const firstCurly = stdout.indexOf('{')
  const lastCurly = stdout.lastIndexOf('}')
  const sliced = stdout.slice(firstCurly, lastCurly + 1)
  return JSON.parse(sliced)
}
