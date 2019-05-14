import fs from 'fs-extra'
import path from 'path'
import { TSClient } from './TSClient'
import { getDMMF } from '../utils/getDMMF'
import { getInternalDatamodelJson } from '@prisma/engine-core'
import { createProgram, ScriptTarget, ModuleKind } from 'typescript'

export async function generateClient(
  datamodel: string,
  prismaYmlPath: string,
  outputDir: string,
  transpile: boolean = false,
) {
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
  const target = path.join(outputDir, 'index.ts')
  await fs.writeFile(target, generatedClient)

  /**
   * If transpile === true, replace index.ts with index.js and index.d.ts
   * WARNING: This takes a long time
   * TODO: Implement transpilation as a separate code generator
   */
  if (transpile) {
    const before = Date.now()
    createProgram({
      rootNames: [target],
      options: {
        declaration: true,
        lib: ['esnext'],
        target: ScriptTarget.ES2015,
        skipDefaultLibCheck: true,
        noStrictGenericChecks: true,
        incremental: true,
        tsBuildInfoFile: path.join(__dirname, './build-cache'), // TODO: find out why this is not working
        module: ModuleKind.CommonJS,
      },
    }).emit()
    const after = Date.now()
    console.log(`Compiled TypeScript in ${after - before}ms`)
    await fs.remove(target)
  }
}
