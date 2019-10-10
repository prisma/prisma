import copy from '@apexearth/copy'
import { BinaryPaths, DataSource, DMMF, GeneratorConfig } from '@prisma/generator-helper'
import chalk from 'chalk'
import Debug from 'debug'
import fs from 'fs'
import makeDir from 'make-dir'
import path from 'path'
import {
  CompilerOptions,
  createCompilerHost,
  createProgram,
  createSourceFile,
  ModuleKind,
  ScriptTarget,
} from 'typescript'
import { promisify } from 'util'
import { DMMF as PhotonDMMF } from '../runtime/dmmf-types'
import { Dictionary } from '../runtime/utils/common'
import { getPhotonDMMF } from '../utils/getDMMF'
import { resolveDatasources } from '../utils/resolveDatasources'
import { extractSqliteSources } from './extractSqliteSources'
import { TSClient } from './TSClient'

const debug = Debug('generateClient')

const remove = promisify(fs.unlink)
const writeFile = promisify(fs.writeFile)
const exists = promisify(fs.exists)
const copyFile = promisify(fs.copyFile)

export interface GenerateClientOptions {
  datamodel: string
  datamodelPath?: string
  browser?: boolean
  schemaDir?: string
  transpile?: boolean
  runtimePath?: string
  outputDir: string
  version?: string
  generator?: GeneratorConfig
  dmmf: DMMF.Document
  datasources: DataSource[]
  binaryPaths: BinaryPaths
}

export interface BuildClientResult {
  fileMap: Dictionary<string>
  photonDmmf: PhotonDMMF.Document
}

export async function buildClient({
  datamodel,
  schemaDir = process.cwd(),
  transpile = false,
  runtimePath = './runtime',
  browser = false,
  binaryPaths,
  outputDir,
  generator,
  version,
  dmmf,
  datasources,
}: GenerateClientOptions): Promise<BuildClientResult> {
  const fileMap = {}

  const document = getPhotonDMMF(dmmf)

  const client = new TSClient({
    document,
    datamodel,
    runtimePath,
    browser,
    datasources: resolveDatasources(datasources, schemaDir, outputDir),
    sqliteDatasourceOverrides: extractSqliteSources(datamodel, schemaDir, outputDir),
    generator,
    platforms: Object.keys(binaryPaths.queryEngine!),
    version,
    schemaDir,
    outputDir,
  })

  const generatedClient = String(client)
  const target = '@generated/photon/index.ts'

  if (!transpile) {
    fileMap[target] = generatedClient
    return {
      fileMap: normalizeFileMap(fileMap),
      photonDmmf: document,
    }
  }

  /**
   * If transpile === true, replace index.ts with index.js and index.d.ts
   * WARNING: This takes a long time
   * TODO: Implement transpilation as a separate code generator
   */

  const options: CompilerOptions = {
    module: ModuleKind.CommonJS,
    target: ScriptTarget.ES2016,
    lib: ['lib.esnext.d.ts', 'lib.dom.d.ts'],
    declaration: true,
    strict: true,
    suppressOutputPathCheck: false,
    esModuleInterop: true,
  }
  const file: any = { fileName: target, content: generatedClient }

  const compilerHost = createCompilerHost(options)
  const originalGetSourceFile = compilerHost.getSourceFile
  compilerHost.getSourceFile = fileName => {
    const newFileName = redirectToLib(fileName)
    if (fileName === file.fileName) {
      file.sourceFile = file.sourceFile || createSourceFile(fileName, file.content, ScriptTarget.ES2015, true)
      return file.sourceFile
    }
    return (originalGetSourceFile as any).call(compilerHost, newFileName)
  }
  compilerHost.writeFile = (fileName, data) => {
    if (fileName.includes('@generated/photon')) {
      fileMap[fileName] = data
    }
  }

  const program = createProgram([file.fileName], options, compilerHost)
  const result = program.emit()
  if (result.diagnostics.length > 0) {
    console.log(chalk.redBright('Errors during Photon generation:'))
    console.log(result.diagnostics.map(d => d.messageText).join('\n'))
  }

  return {
    fileMap: normalizeFileMap(fileMap),
    photonDmmf: document,
  }
}

function normalizeFileMap(fileMap: Dictionary<string>) {
  const sliceLength = '@generated/photon/'.length
  return Object.entries(fileMap).reduce((acc, [key, value]) => {
    acc[key.slice(sliceLength)] = value
    return acc
  }, {})
}

export async function generateClient({
  datamodel,
  datamodelPath,
  schemaDir = datamodelPath ? path.dirname(datamodelPath) : process.cwd(),
  outputDir,
  transpile,
  runtimePath,
  browser,
  version = 'latest',
  generator,
  dmmf,
  datasources,
  binaryPaths,
}: GenerateClientOptions): Promise<BuildClientResult | undefined> {
  runtimePath = runtimePath || './runtime'
  const { photonDmmf, fileMap } = await buildClient({
    datamodel,
    schemaDir,
    transpile,
    runtimePath,
    browser,
    outputDir,
    generator,
    datamodelPath,
    version,
    dmmf,
    datasources,
    binaryPaths,
  })

  if (generator && generator.config && generator.config.inMemory) {
    return { photonDmmf, fileMap }
  }

  await makeDir(outputDir)
  await Promise.all(
    Object.entries(fileMap).map(async ([fileName, file]) => {
      const filePath = path.join(outputDir, fileName)
      // The deletion of the file is necessary, so VSCode
      // picks up the changes.
      if (await exists(filePath)) {
        await remove(filePath)
      }
      await writeFile(filePath, file)
    }),
  )
  const inputDir = eval(`require('path').join(__dirname, '../runtime')`) // tslint:disable-line

  await copy({
    from: inputDir,
    to: path.join(outputDir, '/runtime'),
    recursive: true,
    parallelJobs: 20,
    overwrite: true,
  })

  if (!binaryPaths.queryEngine) {
    throw new Error(`Photon.js needs \`queryEngine\` in the \`binaryPaths\` object.`)
  }

  for (const filePath of Object.values(binaryPaths.queryEngine)) {
    const fileName = path.basename(filePath)
    const target = path.join(outputDir, 'runtime', fileName)
    debug(`Copying ${filePath} to ${target}`)
    await copyFile(filePath, target)
  }

  await writeFile(path.join(outputDir, '/runtime/index.d.ts'), backup)
}

const backup = `export { DMMF } from './dmmf-types'
// export { DMMFClass } from './dmmf'
// export { deepGet, deepSet } from './utils/deep-set'
// export { makeDocument, transformDocument } from './query'

export declare var Engine: any
export declare type Engine = any

// export declare var DMMF: any
// export declare type DMMF = any

export declare var DMMFClass: any
export declare type DMMFClass = any

export declare var deepGet: any
export declare type deepGet = any

export declare var chalk: any
export declare type chalk = any

export declare var deepSet: any
export declare type deepSet = any

export declare var makeDocument: any
export declare type makeDocument = any

export declare var transformDocument: any
export declare type transformDocument = any

export declare var debug: any
export declare type debug = any

export declare var debugLib: any
export declare type debugLib = any

export declare var InternalDatasource: any
export declare type InternalDatasource = any

export declare var Datasource: any
export declare type Datasource = any

export declare var printDatasources: any
export declare type printDatasources = any

export declare var printStack: any
export declare type printStack = any

export declare var mergeBy: any
export declare type mergeBy = any
`

// This is needed because ncc rewrite some paths
function redirectToLib(fileName: string) {
  const file = path.basename(fileName)
  if (/^lib\.(.*?)\.d\.ts$/.test(file)) {
    if (!fs.existsSync(fileName)) {
      const dir = path.dirname(fileName)
      let newPath = path.join(dir, 'lib', file)
      if (!fs.existsSync(newPath)) {
        newPath = path.join(dir, 'typescript/lib', file)
      }
      return newPath
    }
  }

  return fileName
}
