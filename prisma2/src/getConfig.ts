import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import { LiftEngine } from '@prisma/lift'

const readFile = promisify(fs.readFile)
const exists = promisify(fs.exists)

export async function getConfig(cwd: string) {
  const datamodel = await getDatamodel(cwd)
  const engine = new LiftEngine({ projectDir: cwd })
  return engine.getConfig({ datamodel })
}

export async function getDatamodel(cwd: string): Promise<string> {
  const datamodelPath = path.join(cwd, 'project.prisma')
  if (!(await exists(datamodelPath))) {
    throw new Error(`Could not find ${datamodelPath}`)
  }
  return readFile(datamodelPath, 'utf-8')
}
