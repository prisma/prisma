import type { BinaryTarget } from '@prisma/get-platform'
import { ClientEngineType, EnvPaths, getClientEngineType, pathToPosix } from '@prisma/internals'
import ciInfo from 'ci-info'
import crypto from 'crypto'
import path from 'path'
import type { O } from 'ts-toolbelt'

import type { GetPrismaClientConfig } from '../../runtime/getPrismaClient'
import { datamodelEnumToSchemaEnum, DMMFHelper } from '../dmmf'
import type { FileMap } from '../generateClient'
import { GenerateClientOptions } from '../generateClient'
import { GenericArgsInfo } from '../GenericsArgsInfo'
import * as ts from '../ts-builders'
import { buildDebugInitialization } from '../utils/buildDebugInitialization'
import { buildDirname } from '../utils/buildDirname'
import { buildRuntimeDataModel } from '../utils/buildDMMF'
import { buildQueryCompilerWasmModule } from '../utils/buildGetQueryCompilerWasmModule'
import { buildQueryEngineWasmModule } from '../utils/buildGetQueryEngineWasmModule'
import { buildInjectableEdgeEnv } from '../utils/buildInjectableEdgeEnv'
import { buildNFTAnnotations } from '../utils/buildNFTAnnotations'
import { buildRequirePath } from '../utils/buildRequirePath'
import { buildWarnEnvConflicts } from '../utils/buildWarnEnvConflicts'
import { createClientFile } from './ClientFile'
import { commonCodeJS } from './common'
import { createCommonFile } from './CommonFile'
import { createCountTypesFile } from './CountTypesFile'
import { createDeepInputTypesFile } from './DeepInputTypesFile'
import { Enum } from './Enum'
import { createEnumsFile } from './EnumsFile'
import { type Generable } from './Generable'
import { GenerateContext } from './GenerateContext'
import { Model } from './Model'
import { createModelFiles } from './ModelFiles'

type RuntimeName =
  | 'binary'
  | 'library'
  | 'wasm'
  | 'edge'
  | 'edge-esm'
  | 'index-browser'
  | 'react-native'
  | 'client'
  | (string & {}) // workaround to also allow other strings while keeping auto-complete intact

export type TSClientOptions = O.Required<GenerateClientOptions, 'runtimeBase'> & {
  /** More granular way to define JS runtime name */
  runtimeNameJs: RuntimeName
  /** More granular way to define TS runtime name */
  runtimeNameTs: RuntimeName
  /** When generating the browser client */
  browser: boolean
  /** When generating via the Deno CLI */
  deno: boolean
  /** When we are generating an /edge client */
  edge: boolean
  /** When we are generating a /wasm client */
  wasm: boolean
  /** When types don't need to be regenerated */
  reusedTs?: string // the entrypoint to reuse
  /** When js doesn't need to be regenerated */
  reusedJs?: string // the entrypoint to reuse

  /** result of getEnvPaths call */
  envPaths: EnvPaths
}

export class TSClient implements Generable {
  protected readonly dmmf: DMMFHelper
  protected readonly genericsInfo: GenericArgsInfo

  constructor(protected readonly options: TSClientOptions) {
    this.dmmf = new DMMFHelper(options.dmmf)
    this.genericsInfo = new GenericArgsInfo(this.dmmf)
  }

  public toJS(): string {
    const {
      edge,
      wasm,
      binaryPaths,
      generator,
      outputDir,
      datamodel: inlineSchema,
      runtimeBase,
      runtimeNameJs,
      datasources,
      deno,
      copyEngine = true,
      reusedJs,
      envPaths,
    } = this.options

    if (reusedJs) {
      return `module.exports = { ...require('${reusedJs}') }`
    }

    const relativeEnvPaths = {
      rootEnvPath: envPaths.rootEnvPath && pathToPosix(path.relative(outputDir, envPaths.rootEnvPath)),
      schemaEnvPath: envPaths.schemaEnvPath && pathToPosix(path.relative(outputDir, envPaths.schemaEnvPath)),
    }

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
    const config: Omit<GetPrismaClientConfig, 'runtimeDataModel' | 'dirname'> = {
      generator,
      relativeEnvPaths,
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
    }

    // get relative output dir for it to be preserved even after bundling, or
    // being moved around as long as we keep the same project dir structure.
    const relativeOutdir = path.relative(process.cwd(), outputDir)

    const code = `${commonCodeJS({ ...this.options, browser: false })}
${buildRequirePath(edge)}

/**
 * Enums
 */
${this.dmmf.schema.enumTypes.prisma?.map((type) => new Enum(type, true).toJS()).join('\n\n')}
${this.dmmf.datamodel.enums
  .map((datamodelEnum) => new Enum(datamodelEnumToSchemaEnum(datamodelEnum), false).toJS())
  .join('\n\n')}

${new Enum(
  {
    name: 'ModelName',
    values: this.dmmf.mappings.modelOperations.map((m) => m.model),
  },
  true,
).toJS()}
/**
 * Create the Client
 */
const config = ${JSON.stringify(config, null, 2)}
${buildDirname(edge, relativeOutdir)}
${buildRuntimeDataModel(this.dmmf.datamodel, runtimeNameJs)}
${buildQueryEngineWasmModule(wasm, copyEngine, runtimeNameJs)}
${buildQueryCompilerWasmModule(wasm, copyEngine, runtimeNameJs)}
${buildInjectableEdgeEnv(edge, datasources)}
${buildWarnEnvConflicts(edge, runtimeBase, runtimeNameJs)}
${buildDebugInitialization(edge)}
const PrismaClient = getPrismaClient(config)
exports.PrismaClient = PrismaClient
Object.assign(exports, Prisma)${deno ? '\nexport { exports as default, Prisma, PrismaClient }' : ''}
${buildNFTAnnotations(edge || !copyEngine, clientEngineType, binaryTargets, relativeOutdir)}
`
    return code
  }

  public toTS(): string {
    const { reusedTs } = this.options

    // in some cases, we just re-export the existing types
    if (reusedTs) {
      const topExports = ts.moduleExportFrom(`./${reusedTs}`)

      return ts.stringify(topExports)
    }

    const context = new GenerateContext({
      dmmf: this.dmmf,
      genericArgsInfo: this.genericsInfo,
      generator: this.options.generator,
      runtimeJsPath: `${this.options.runtimeBase}/${this.options.runtimeNameTs}`,
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
          ts.moduleExport(ts.constDeclaration(datamodelEnum.name, ts.namedType(`typeof $Enums.${datamodelEnum.name}`))),
        ),
      ].join('\n')
    })

    return `
import * as runtime from '${context.runtimeJsPath}'
import $Public = runtime.Types.Public
import $Result = runtime.Types.Result

import type * as Prisma from './common'
${context.dmmf.datamodel.enums.length > 0 ? `import type * as $Enums from './enums'` : ''}

export type * as Prisma from './common'
${context.dmmf.datamodel.enums.length > 0 ? `export type * as $Enums from './enums'` : ''}

export { PrismaClient } from './client'

export type PrismaPromise<T> = $Public.PrismaPromise<T>

${modelAndTypes.map((m) => m.toTSWithoutNamespace()).join('\n')}

${modelEnumsAliases.length > 0 ? `${modelEnumsAliases.join('\n\n')}` : ''}
`
  }

  public toBrowserJS(): string {
    const code = `${commonCodeJS({
      ...this.options,
      runtimeNameJs: 'index-browser',
      browser: true,
    })}
/**
 * Enums
 */

${this.dmmf.schema.enumTypes.prisma?.map((type) => new Enum(type, true).toJS()).join('\n\n')}
${this.dmmf.schema.enumTypes.model?.map((type) => new Enum(type, false).toJS()).join('\n\n') ?? ''}

${new Enum(
  {
    name: 'ModelName',
    values: this.dmmf.mappings.modelOperations.map((m) => m.model),
  },
  true,
).toJS()}

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = \`PrismaClient is not configured to run in \${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
\`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in \`' + runtime.prettyName + '\`).'
        }
        
        message += \`
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report\`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
`
    return code
  }

  generateModelAndHelperFiles(): FileMap {
    const context = new GenerateContext({
      dmmf: this.dmmf,
      genericArgsInfo: this.genericsInfo,
      generator: this.options.generator,
      runtimeJsPath: `${this.options.runtimeBase}/${this.options.runtimeNameTs}`,
    })

    const modelsFileMap: FileMap = createModelFiles(context)
    modelsFileMap['deepInputTypes.d.ts'] = createDeepInputTypesFile(context)
    modelsFileMap['countTypes.d.ts'] = createCountTypesFile(context)

    const modelsBarrelFileContent = `
import * as runtime from '${context.runtimeJsPath}'

export import JsonObject = runtime.JsonObject
export import JsonArray = runtime.JsonArray
export import JsonValue = runtime.JsonValue
export import InputJsonObject = runtime.InputJsonObject
export import InputJsonArray = runtime.InputJsonArray
export import InputJsonValue = runtime.InputJsonValue

${Object.keys(modelsFileMap)
  .map((m) => `export type * from './models/${m}'`)
  .join('\n')}
`

    return {
      'models.d.ts': modelsBarrelFileContent,
      'common.d.ts': createCommonFile(context, this.options),
      'client.d.ts': createClientFile(context, this.options),
      'enums.d.ts': createEnumsFile(context),
      models: modelsFileMap,
    }
  }
}
