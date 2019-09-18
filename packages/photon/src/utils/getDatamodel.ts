import fs from 'fs'
import path from 'path'
import { promisify } from 'util'

const readFile = promisify(fs.readFile)
const exists = promisify(fs.exists)

export async function getDatamodelPath(cwd: string): Promise<string> {
  let datamodelPath = path.join(cwd, 'schema.prisma')
  if (!(await exists(datamodelPath))) {
    datamodelPath = path.join(cwd, 'prisma/schema.prisma')
  }
  if (!(await exists(datamodelPath))) {
    throw new Error(`Could not find ${datamodelPath}`)
  }

  return datamodelPath
}

export async function getDatamodel(cwd: string): Promise<string> {
  const datamodelPath = await getDatamodelPath(cwd)
  return readFile(datamodelPath, 'utf-8')
}
