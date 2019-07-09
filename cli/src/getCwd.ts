import { promisify } from 'util'
import fs from 'fs'
import path from 'path'

const exists = promisify(fs.exists)
const readFile = promisify(fs.readFile)

const datamodelFile = 'project.prisma'
const schemaFile = 'schema.prisma'

/**
 * Prefer the folder that has the project.prisma.
 * So if there is an empty prisma dir, but a project.prisma in cwd, take cwd.
 * If nothing in particular can be found, take process.cwd() as the default
 */
export async function getCwd(): Promise<string> {
  const cwd = process.cwd()
  const [
    datamodelCwdExists,
    prismaFolderExists,
    prismaDatamodelExists,
  ] = await Promise.all([
    exists(path.join(cwd, datamodelFile)),
    exists(path.join(cwd, schemaFile)),
    exists(path.join(cwd, 'prisma/')),
    exists(path.join(cwd, 'prisma/', datamodelFile)),
    exists(path.join(cwd, 'prisma/', schemaFile)),
  ])

  if (datamodelCwdExists) {
    return cwd
  }

  if (prismaFolderExists || prismaDatamodelExists) {
    return path.join(cwd, 'prisma/')
  }

  return cwd
}

export async function getDatamodel(): Promise<string> {
  const cwd = await getCwd()
  let datamodelPath = path.join(cwd, datamodelFile)
  if (!(await exists(datamodelPath))) {
    let datamodelPath = path.join(cwd, schemaFile)
  }
  if (!(await exists(datamodelPath))) {
    throw new Error(`Could not find ${datamodelPath}`)
  }
  return readFile(datamodelPath, 'utf-8')
}
