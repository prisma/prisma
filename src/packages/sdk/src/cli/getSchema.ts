import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import execa from 'execa'
import readPkgUp from 'read-pkg-up'

const exists = promisify(fs.exists)
const readFile = promisify(fs.readFile)

/**
 * Async
 */

export async function getSchemaPath(schemaPathFromArgs?: string) {
  return getSchemaPathInternal(schemaPathFromArgs, {
    cwd: process.cwd(),
  })
}

export async function getSchemaPathInternal(
  schemaPathFromArgs?: string,
  opts: { cwd: string } = {
    cwd: process.cwd(),
  },
): Promise<string | null> {
  if (schemaPathFromArgs) {
    // 1. try the user custom path
    const customSchemaPath = await getAbsoluteSchemaPath(
      path.resolve(schemaPathFromArgs),
    )
    if (!customSchemaPath) {
      throw new Error(
        `Provided --schema at ${schemaPathFromArgs} doesn't exist.`,
      )
    }

    return customSchemaPath
  }

  // 2. Try the package.json `prisma.schema` custom path
  // 3. Try the conventional ./schema.prisma or ./prisma/schema.prisma paths
  const schemaPath =
    (await getSchemaPathFromPackageJson(opts.cwd)) ??
    (await getRelativeSchemaPath(opts.cwd))

  if (schemaPath) {
    return schemaPath
  }

  // 4. In case no schema can't be found there, try the npm-based INIT_CWD
  if (process.env.INIT_CWD) {
    return (
      (await getSchemaPathFromPackageJson(process.env.INIT_CWD)) ??
      (await getRelativeSchemaPath(process.env.INIT_CWD)) ??
      (await resolveYarnSchema(process.env.INIT_CWD))
    )
  }

  return null
}

export async function getSchemaPathFromPackageJson(
  cwd: string,
): Promise<string | null> {
  const pkgJson = await readPkgUp({ cwd })
  const schemaPathFromPkgJson: string | undefined =
    pkgJson?.packageJson?.prisma?.schema

  if (!schemaPathFromPkgJson || !pkgJson) {
    return null
  }

  if (typeof schemaPathFromPkgJson !== 'string') {
    throw new Error(
      `Provided schema path configuration \`${schemaPathFromPkgJson}\` at ./${path.relative(
        cwd,
        pkgJson.path,
      )} must be of type string`,
    )
  }

  const absoluteSchemaPath = path.isAbsolute(schemaPathFromPkgJson)
    ? schemaPathFromPkgJson
    : path.resolve(path.dirname(pkgJson.path), schemaPathFromPkgJson)

  if ((await exists(absoluteSchemaPath)) === false) {
    throw new Error(
      `Provided schema path at ./${path.relative(
        cwd,
        absoluteSchemaPath,
      )} from ./${path.relative(cwd, pkgJson.path)} doesn't exist.`,
    )
  }

  return absoluteSchemaPath
}

async function resolveYarnSchema(cwd: string): Promise<null | string> {
  if (process.env.npm_config_user_agent?.includes('yarn')) {
    try {
      const { stdout: version } = await execa.command('yarn --version', {
        cwd,
      })

      if (version.startsWith('2')) {
        return null
      }

      const { stdout } = await execa.command('yarn workspaces info --json', {
        cwd,
      })
      const json = getJson(stdout)

      for (const workspace of Object.values<any>(json)) {
        const workspacePath = path.join(cwd, workspace.location)
        const workspaceSchemaPath =
          (await getSchemaPathFromPackageJson(workspacePath)) ??
          (await getRelativeSchemaPath(workspacePath))

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

function resolveYarnSchemaSync(cwd: string): string | null {
  if (process.env.npm_config_user_agent?.includes('yarn')) {
    try {
      const { stdout: version } = execa.commandSync('yarn --version', {
        cwd,
      })

      if (version.startsWith('2')) {
        return null
      }

      const { stdout } = execa.commandSync('yarn workspaces info --json', {
        cwd,
      })
      const json = getJson(stdout)

      for (const workspace of Object.values<any>(json)) {
        const workspacePath = path.join(cwd, workspace.location)
        let workspaceSchemaPath =
          getSchemaPathFromPackageJsonSync(workspacePath) ??
          getRelativeSchemaPathSync(workspacePath)

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

export async function getRelativeSchemaPath(
  cwd: string,
): Promise<string | null> {
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
  schemaPathFromArgs?: string,
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

export function getSchemaPathSync(schemaPathFromArgs?: string) {
  return getSchemaPathSyncInternal(schemaPathFromArgs, {
    cwd: process.cwd(),
  })
}

export function getSchemaPathSyncInternal(
  schemaPathFromArgs?: string,
  opts: { cwd: string } = {
    cwd: process.cwd(),
  },
): string | null {
  if (schemaPathFromArgs) {
    // 1. Try the user custom path
    const customSchemaPath = getAbsoluteSchemaPathSync(
      path.resolve(schemaPathFromArgs),
    )
    if (!customSchemaPath) {
      throw new Error(
        `Provided --schema at ${schemaPathFromArgs} doesn't exist.`,
      )
    }

    return customSchemaPath
  }

  // 2. Try the package.json `prisma.schema` custom path
  // 3. Try the conventional `./schema.prisma` or `./prisma/schema.prisma` paths
  const schemaPath =
    getSchemaPathFromPackageJsonSync(opts.cwd) ??
    getRelativeSchemaPathSync(opts.cwd)

  if (schemaPath) {
    return schemaPath
  }

  // 4. In case no schema can't be found there, try the npm-based INIT_CWD
  if (process.env.INIT_CWD) {
    return (
      getSchemaPathFromPackageJsonSync(process.env.INIT_CWD) ??
      getRelativeSchemaPathSync(process.env.INIT_CWD) ??
      resolveYarnSchemaSync(process.env.INIT_CWD)
    )
  }

  return null
}

export function getSchemaPathFromPackageJsonSync(cwd: string): string | null {
  const pkgJson = readPkgUp.sync({ cwd })
  const schemaPathFromPkgJson: string | undefined =
    pkgJson?.packageJson?.prisma?.schema

  if (!schemaPathFromPkgJson || !pkgJson) {
    return null
  }

  if (typeof schemaPathFromPkgJson !== 'string') {
    throw new Error(
      `Provided schema path configuration \`${schemaPathFromPkgJson}\` at ./${path.relative(
        cwd,
        pkgJson.path,
      )} must be of type string`,
    )
  }

  const absoluteSchemaPath = path.isAbsolute(schemaPathFromPkgJson)
    ? schemaPathFromPkgJson
    : path.resolve(path.dirname(pkgJson.path), schemaPathFromPkgJson)

  if (fs.existsSync(absoluteSchemaPath) === false) {
    throw new Error(
      `Provided schema path at ./${path.relative(
        cwd,
        absoluteSchemaPath,
      )} from ./${path.relative(cwd, pkgJson.path)} doesn't exist.`,
    )
  }

  return absoluteSchemaPath
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
