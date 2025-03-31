import crypto from 'node:crypto'
import path from 'node:path'

import type { GetPrismaClientConfig } from '@prisma/client-common'
import type { BinaryTarget } from '@prisma/get-platform'
import { ClientEngineType, getClientEngineType, pathToPosix } from '@prisma/internals'
import * as ts from '@prisma/ts-builders'
import ciInfo from 'ci-info'
import type { O } from 'ts-toolbelt'

import { DMMFHelper } from '../dmmf'
import type { FileMap } from '../generateClient'
import { GenerateClientOptions } from '../generateClient'
import { GenericArgsInfo } from '../GenericsArgsInfo'
import { buildDebugInitialization } from '../utils/buildDebugInitialization'
import { buildDirname } from '../utils/buildDirname'
import { buildRuntimeDataModel } from '../utils/buildDMMF'
import { buildGetWasmModule } from '../utils/buildGetWasmModule'
import { buildInjectableEdgeEnv } from '../utils/buildInjectableEdgeEnv'
import { buildNFTAnnotations } from '../utils/buildNFTAnnotations'
import { createClassFile } from './file-generators/ClassFile'
import { createCommonFile } from './file-generators/CommonFile'
import { createEnumsFile } from './file-generators/EnumsFile'
import { createModelFiles } from './file-generators/ModelFiles'
import { createModelsFile } from './file-generators/ModelsFile'
import { type Generable } from './Generable'
import { GenerateContext } from './GenerateContext'
import { Model } from './Model'

export type RuntimeName = 'binary' | 'library' | 'wasm' | 'edge' | 'react-native' | 'client' | (string & {})

export type TSClientOptions = O.Required<GenerateClientOptions, 'runtimeBase'> & {
  /** The name of the runtime bundle to use */
  runtimeName: RuntimeName
  /** When we are generating an edge-compatible client */
  edge: boolean
}

export class TSClient implements Generable {
  protected readonly dmmf: DMMFHelper
  protected readonly genericsInfo: GenericArgsInfo

  constructor(protected readonly options: TSClientOptions) {
    this.dmmf = new DMMFHelper(options.dmmf)
    this.genericsInfo = new GenericArgsInfo(this.dmmf)
  }

  public toTS(): string {
    const {
      edge,
      binaryPaths,
      generator,
      outputDir,
      datamodel: inlineSchema,
      runtimeBase,
      runtimeName,
      datasources,
      copyEngine = true,
      target,
      activeProvider,
      moduleFormat,
    } = this.options

    // This ensures that any engine override is propagated to the generated clients config
    const clientEngineType = getClientEngineType(generator)
    generator.config.engineType = clientEngineType

    const binaryTargets =
      clientEngineType === ClientEngineType.Library
        ? (Object.keys(binaryPaths.libqueryEngine ?? {}) as BinaryTarget[])
        : (Object.keys(binaryPaths.queryEngine ?? {}) as BinaryTarget[])

    const inlineSchemaHash = crypto
      .createHash('sha256')
      .update(Buffer.from(inlineSchema, 'utf8').toString('base64'))
      .digest('hex')

    const datasourceFilePath = datasources[0].sourceFilePath
    const config: GetPrismaClientConfig = {
      generator,
      relativePath: pathToPosix(path.relative(outputDir, path.dirname(datasourceFilePath))),
      clientVersion: this.options.clientVersion,
      engineVersion: this.options.engineVersion,
      datasourceNames: datasources.map((d) => d.name),
      activeProvider: this.options.activeProvider,
      postinstall: this.options.postinstall,
      ciName: ciInfo.name ?? undefined,
      inlineDatasources: datasources.reduce((acc, ds) => {
        return (acc[ds.name] = { url: ds.url }), acc
      }, {} as GetPrismaClientConfig['inlineDatasources']),
      inlineSchema,
      inlineSchemaHash,
      copyEngine,
      runtimeDataModel: { models: {}, enums: {}, types: {} },
      dirname: '',
    }

    // get relative output dir for it to be preserved even after bundling, or
    // being moved around as long as we keep the same project dir structure.
    const relativeOutdir = path.relative(process.cwd(), outputDir)

    const clientConfig = `
/**
 * Create the Client
 */
const config: runtime.GetPrismaClientConfig = ${JSON.stringify(config, null, 2)}
${buildDirname(edge)}
${buildRuntimeDataModel(this.dmmf.datamodel, runtimeName)}
${buildGetWasmModule({ component: 'engine', runtimeBase, runtimeName, target, activeProvider, moduleFormat })}
${buildGetWasmModule({ component: 'compiler', runtimeBase, runtimeName, target, activeProvider, moduleFormat })}
${buildInjectableEdgeEnv(edge, datasources)}
${buildDebugInitialization(edge)}
${buildNFTAnnotations(edge || !copyEngine, clientEngineType, binaryTargets, relativeOutdir)}
`

    const context = new GenerateContext({
      dmmf: this.dmmf,
      genericArgsInfo: this.genericsInfo,
      generator: this.options.generator,
      runtimeJsPath: `${this.options.runtimeBase}/${this.options.runtimeName}`,
    })

    const modelAndTypes = Object.values(context.dmmf.typeAndModelMap)
      .filter((modelOrType) => context.dmmf.outputTypeMap.model[modelOrType.name])
      .map((modelOrType) => new Model(modelOrType, context))

    const modelEnumsAliases = this.dmmf.datamodel.enums.map((datamodelEnum) => {
      return [
        ts.stringify(
          ts.moduleExport(ts.typeDeclaration(datamodelEnum.name, ts.namedType(`$Enums.${datamodelEnum.name}`))),
        ),
        ts.stringify(
          ts.moduleExport(
            ts.constDeclaration(datamodelEnum.name).setValue(ts.namedValue(`$Enums.${datamodelEnum.name}`)),
          ),
        ),
      ].join('\n')
    })

    return `
import * as runtime from '${context.runtimeJsPath}'
import type * as Prisma from './common'
export * as Prisma from './common'
export { PrismaClient } from './class'

${context.dmmf.datamodel.enums.length > 0 ? `import type * as $Enums from './enums'` : ''}
${context.dmmf.datamodel.enums.length > 0 ? `export type * as $Enums from './enums'` : ''}

${clientConfig}

${modelAndTypes.map((m) => m.toTSWithoutNamespace()).join('\n')}
${modelEnumsAliases.length > 0 ? `${modelEnumsAliases.join('\n\n')}` : ''}
`
  }

  generateModelAndHelperFiles(): FileMap {
    const context = new GenerateContext({
      dmmf: this.dmmf,
      genericArgsInfo: this.genericsInfo,
      generator: this.options.generator,
      runtimeJsPath: `${this.options.runtimeBase}/${this.options.runtimeName}`,
    })

    const modelsFileMap: FileMap = createModelFiles(context)

    return {
      'models.d.ts': createModelsFile(context, modelsFileMap),
      'common.d.ts': createCommonFile(context, this.options),
      'class.d.ts': createClassFile(context, this.options),
      'enums.d.ts': createEnumsFile(context),
      models: modelsFileMap,
    }
  }
}
