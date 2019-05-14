import fs from 'fs-extra'
import path from 'path'
import { TSClient } from './TSClient'
import { getDMMF } from '../utils/getDMMF'
import { getInternalDatamodelJson } from '@prisma/engine-core'
// import { hashElement } from 'folder-hash'

export async function generateClient(datamodel: string, prismaYmlPath: string, outputDir: string) {
  if (!(await fs.pathExists(prismaYmlPath))) {
    throw new Error(`Provided prisma.yml path ${prismaYmlPath} does not exist`)
  }

  const prismaConfig = await fs.readFile(prismaYmlPath, 'utf-8')
  const internalDatamodelJson = await getInternalDatamodelJson(
    datamodel,
    path.join(__dirname, '../../runtime/schema-inferrer-bin'),
  )

  await fs.mkdirp(outputDir)

  const client = new TSClient(getDMMF(datamodel), prismaYmlPath, prismaConfig, datamodel, internalDatamodelJson)
  const generatedClient = String(client)
  await fs.copy(path.join(__dirname, '../../runtime'), path.join(outputDir, '/runtime'))
  await fs.writeFile(path.join(outputDir, 'index.ts'), generatedClient)
}
