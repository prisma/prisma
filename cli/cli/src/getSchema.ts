import { promisify } from 'util'
import fs from 'fs'
import path from 'path'

const exists = promisify(fs.exists)
const readFile = promisify(fs.readFile)

function getContextualCwd() {
  // For https://github.com/prisma/photonjs/issues/261
  // When prisma2 generate is run from within node_modules, npm scripts provide that path as the process.cwd() path
  // However, it also provides the init cwd in this environment variable: https://docs.npmjs.com/cli/run-script
  return process.env.INIT_CWD || process.cwd()
}

/**
 * Async
 */

export async function getSchemaPath(): Promise<string | null> {
  let schemaPath = path.join(getContextualCwd(), 'schema.prisma')
  if (await exists(schemaPath)) {
    return schemaPath
  }

  schemaPath = path.join(getContextualCwd(), `prisma/schema.prisma`)

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
  let schemaPath = path.join(getContextualCwd(), 'schema.prisma')

  if (fs.existsSync(schemaPath)) {
    return schemaPath
  }

  schemaPath = path.join(getContextualCwd(), `prisma/schema.prisma`)

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
