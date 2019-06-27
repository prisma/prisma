import { promisify } from 'util'
import fs from 'fs'
import path from 'path'

const exists = promisify(fs.exists)
const readFile = promisify(fs.readFile)

const datamodelFile = 'project.prisma'

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
    exists(path.join(cwd, 'prisma/')),
    exists(path.join(cwd, 'prisma/', datamodelFile)),
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
  const datamodelPath = path.join(cwd, datamodelFile)
  const datamodelExists = await exists(datamodelPath)
  if (!datamodelExists) {
    throw new Error(`Could not find ${datamodelPath}`)
  }
  return readFile(datamodelPath, 'utf-8')
}
