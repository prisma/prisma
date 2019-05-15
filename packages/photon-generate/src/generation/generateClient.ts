import fs from 'fs-extra'
import path from 'path'
import { TSClient } from './TSClient'
import { getDMMF } from '../utils/getDMMF'
import { getInternalDatamodelJson } from '@prisma/engine-core'
import {
  createProgram,
  ScriptTarget,
  ModuleKind,
  createCompilerHost,
  createSourceFile,
  CompilerOptions,
} from 'typescript'
const debug = require('debug')('generate')

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
  if (!transpile) {
    await fs.writeFile(target, generatedClient)
    return
  }

  const options: CompilerOptions = {
    module: ModuleKind.CommonJS,
    target: ScriptTarget.ES2016,
    lib: ['lib.esnext.d.ts', 'lib.dom.d.ts'],
    declaration: true,
    strict: true,
    suppressOutputPathCheck: false,
  }
  const file: any = { fileName: target, content: generatedClient }
  // /**
  //  * If transpile === true, replace index.ts with index.js and index.d.ts
  //  * WARNING: This takes a long time
  //  * TODO: Implement transpilation as a separate code generator
  //  */

  const compilerHost = createCompilerHost(options)
  const originalGetSourceFile = compilerHost.getSourceFile
  compilerHost.getSourceFile = fileName => {
    const newFileName = redirectToLib(fileName)
    if (fileName === file.fileName) {
      file.sourceFile = file.sourceFile || createSourceFile(fileName, file.content, ScriptTarget.ES2015, true)
      return file.sourceFile
    }
    return originalGetSourceFile.call(compilerHost, newFileName)
  }

  const program = createProgram([file.fileName], options, compilerHost)
  program.emit()
}

// This is needed because ncc rewrite some paths
function redirectToLib(fileName: string) {
  const file = path.basename(fileName)
  if (/^lib\.(.*?)\.d\.ts$/.test(file)) {
    const dir = path.dirname(fileName)
    return path.join(dir, 'lib', file)
  }

  return fileName
}
