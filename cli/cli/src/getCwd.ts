import { promisify } from 'util'
import fs from 'fs'
import path from 'path'

const exists = promisify(fs.exists)
const readFile = promisify(fs.readFile)

const schemaFile = 'schema.prisma'

/**
 * Prefer the folder that has the project.prisma.
 * So if there is an empty prisma dir, but a project.prisma in cwd, take cwd.
 * If nothing in particular can be found, take process.cwd() as the default
 */
export async function getCwd(): Promise<string> {
  const cwd = process.cwd()
  const [
    schemaCwdExists,
    prismaFolderExists,
    prismaSchemaExists,
  ] = await Promise.all([
    exists(path.join(cwd, schemaFile)),
    exists(path.join(cwd, 'prisma/')),
    exists(path.join(cwd, 'prisma/', schemaFile)),
  ])

  if (schemaCwdExists) {
    return cwd
  }

  if (prismaFolderExists || prismaSchemaExists) {
    return path.join(cwd, 'prisma/')
  }

  return cwd
}

export async function getDatamodel(): Promise<string> {
  let datamodelPath = path.join(process.cwd(), schemaFile)

  if (!(await exists(datamodelPath))) {
    datamodelPath = path.join(process.cwd(), `prisma/${schemaFile}`)
  }

  if (!(await exists(datamodelPath))) {
    throw new Error(`Could not find ${datamodelPath}`)
  }

  return readFile(datamodelPath, 'utf-8')
}
