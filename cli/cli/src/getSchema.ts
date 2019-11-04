import { promisify } from 'util'
import fs from 'fs'
import path from 'path'

const exists = promisify(fs.exists)
const readFile = promisify(fs.readFile)

/**
 * Async
 */

export async function getSchemaPath(): Promise<string | null> {
  // first try the normal cwd
  const schemaPath = await getRelativeSchemaPath(process.cwd())

  if (schemaPath) {
    return schemaPath
  }

  // in case no schema can't be found there, try the npm-based INIT_CWD
  if (process.env.INIT_CWD) {
    return getRelativeSchemaPath(process.env.INIT_CWD)
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
export async function getSchemaDir(): Promise<string | null> {
  const schemaPath = await getSchemaPath()
  if (schemaPath) {
    return path.dirname(schemaPath)
  }

  return null
}

export async function getSchema(): Promise<string> {
  const schemaPath = await getSchemaPath()

  if (!schemaPath) {
    throw new Error(`Could not find schema.prisma`)
  }

  return readFile(schemaPath, 'utf-8')
}

/**
 * Sync
 */

export function getSchemaPathSync(): string | null {
  // first try intuitive schema path
  const schemaPath = getRelativeSchemaPathSync(process.cwd())

  if (schemaPath) {
    return schemaPath
  }

  // in case the normal schema path doesn't exist, try the npm base dir
  if (process.env.INIT_CWD) {
    return getRelativeSchemaPathSync(process.env.INIT_CWD)
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
export function getSchemaDirSync(): string | null {
  const schemaPath = getSchemaPathSync()
  if (schemaPath) {
    return path.dirname(schemaPath)
  }

  return null
}

export function getSchemaSync(): string {
  const schemaPath = getSchemaPathSync()

  if (!schemaPath) {
    throw new Error(`Could not find ${schemaPath || 'schema.prisma'}`)
  }

  return fs.readFileSync(schemaPath, 'utf-8')
}
