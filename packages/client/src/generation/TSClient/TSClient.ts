import type { BinaryTarget } from '@prisma/get-platform'
import { ClientEngineType, EnvPaths, getClientEngineType, pathToPosix } from '@prisma/internals'
import ciInfo from 'ci-info'
import crypto from 'crypto'
import indent from 'indent-string'
import path from 'path'
import { O } from 'ts-toolbelt'

import type { GetPrismaClientConfig } from '../../runtime/getPrismaClient'
import { DMMFHelper } from '../dmmf'
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- used in jsdoc
import type { buildClient } from '../generateClient'
import { GenerateClientOptions } from '../generateClient'
import { GenericArgsInfo } from '../GenericsArgsInfo'
import * as ts from '../ts-builders'
import { buildDebugInitialization } from '../utils/buildDebugInitialization'
import { buildDirname } from '../utils/buildDirname'
import { buildRuntimeDataModel } from '../utils/buildDMMF'
import { buildQueryEngineWasmModule } from '../utils/buildGetQueryEngineWasmModule'
import { buildInjectableEdgeEnv } from '../utils/buildInjectableEdgeEnv'
import { buildNFTAnnotations } from '../utils/buildNFTAnnotations'
import { buildRequirePath } from '../utils/buildRequirePath'
import { buildWarnEnvConflicts } from '../utils/buildWarnEnvConflicts'
import { commonCodeJS, commonCodeTS } from './common'
import { Count } from './Count'
import { DefaultArgsAliases } from './DefaultArgsAliases'
import { Enum } from './Enum'
import { FieldRefInput } from './FieldRefInput'
import { type Generable } from './Generable'
import { GenerateContext } from './GenerateContext'
import { InputType } from './Input'
import { Model } from './Model'
import { PrismaClientClass } from './PrismaClient'

export type TSClientOptions = O.Required<GenerateClientOptions, 'runtimeBase'> & {
  /** More granular way to define JS runtime name */
  runtimeNameJs: 'binary' | 'library' | 'wasm' | 'edge' | 'edge-esm' | 'index-browser' | 'react-native' | String
  /** More granular way to define TS runtime name */
  runtimeNameTs: 'binary' | 'library' | 'wasm' | 'edge' | 'edge-esm' | 'index-browser' | 'react-native' | String
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
      schemaPath,
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
    const config: Omit<GetPrismaClientConfig, 'runtimeDataModel' | 'dirname'> = {
      generator,
      relativeEnvPaths,
      relativePath: pathToPosix(path.relative(outputDir, path.dirname(schemaPath))),
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
${this.dmmf.schema.enumTypes.model?.map((type) => new Enum(type, false).toJS()).join('\n\n') ?? ''}

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
      const topExports = ts.moduleExportFrom('*', `./${reusedTs}`)

      return ts.stringify(topExports)
    }

    const context = new GenerateContext({
      dmmf: this.dmmf,
      genericArgsInfo: this.genericsInfo,
      generator: this.options.generator,
      defaultArgsAliases: new DefaultArgsAliases(),
    })

    const prismaClientClass = new PrismaClientClass(
      context,
      this.options.datasources,
      this.options.outputDir,
      this.options.runtimeNameTs,
      this.options.browser,
      path.dirname(this.options.schemaPath),
    )

    const commonCode = commonCodeTS(this.options)
    const modelAndTypes = Object.values(this.dmmf.typeAndModelMap).reduce((acc, modelOrType) => {
      if (this.dmmf.outputTypeMap.model[modelOrType.name]) {
        acc.push(new Model(modelOrType, context))
      }
      return acc
    }, [] as Model[])

    // TODO: Make this code more efficient and directly return 2 arrays

    const prismaEnums = this.dmmf.schema.enumTypes.prisma?.map((type) => new Enum(type, true).toTS())

    const modelEnums: string[] = []
    const modelEnumsAliases: string[] = []
    for (const enumType of this.dmmf.schema.enumTypes.model ?? []) {
      modelEnums.push(new Enum(enumType, false).toTS())
      modelEnumsAliases.push(
        ts.stringify(ts.moduleExport(ts.typeDeclaration(enumType.name, ts.namedType(`$Enums.${enumType.name}`)))),
        ts.stringify(
          ts.moduleExport(ts.constDeclaration(enumType.name, ts.namedType(`typeof $Enums.${enumType.name}`))),
        ),
      )
    }

    const fieldRefs = this.dmmf.schema.fieldRefTypes.prisma?.map((type) => new FieldRefInput(type).toTS()) ?? []

    const countTypes: Count[] = this.dmmf.schema.outputObjectTypes.prisma
      ?.filter((t) => t.name.endsWith('CountOutputType'))
      .map((t) => new Count(t, context))

    const code = `
/**
 * Client
**/

${commonCode.tsWithoutNamespace()}

${modelAndTypes.map((m) => m.toTSWithoutNamespace()).join('\n')}
${
  modelEnums.length > 0
    ? `
/**
 * Enums
 */
export namespace $Enums {
  ${modelEnums.join('\n\n')}
}

${modelEnumsAliases.join('\n\n')}
`
    : ''
}
${prismaClientClass.toTSWithoutNamespace()}

export namespace Prisma {
${indent(
  `${commonCode.ts()}
${new Enum(
  {
    name: 'ModelName',
    values: this.dmmf.mappings.modelOperations.map((m) => m.model),
  },
  true,
).toTS()}

${prismaClientClass.toTS()}
export type Datasource = {
  url?: string
}

/**
 * Count Types
 */

${countTypes.map((t) => t.toTS()).join('\n')}

/**
 * Models
 */
${modelAndTypes.map((model) => model.toTS()).join('\n')}

/**
 * Enums
 */

${prismaEnums?.join('\n\n')}
${
  fieldRefs.length > 0
    ? `
/**
 * Field references 
 */

${fieldRefs.join('\n\n')}`
    : ''
}
/**
 * Deep Input Types
 */

${this.dmmf.inputObjectTypes.prisma
  ?.reduce((acc, inputType) => {
    if (inputType.name.includes('Json') && inputType.name.includes('Filter')) {
      const needsGeneric = this.genericsInfo.typeNeedsGenericModelArg(inputType)
      const innerName = needsGeneric ? `${inputType.name}Base<$PrismaModel>` : `${inputType.name}Base`
      const typeName = needsGeneric ? `${inputType.name}<$PrismaModel = never>` : inputType.name
      // This generates types for JsonFilter to prevent the usage of 'path' without another parameter
      const baseName = `Required<${innerName}>`
      acc.push(`export type ${typeName} = 
  | PatchUndefined<
      Either<${baseName}, Exclude<keyof ${baseName}, 'path'>>,
      ${baseName}
    >
  | OptionalFlat<Omit<${baseName}, 'path'>>`)
      acc.push(new InputType(inputType, this.genericsInfo).overrideName(`${inputType.name}Base`).toTS())
    } else {
      acc.push(new InputType(inputType, this.genericsInfo).toTS())
    }
    return acc
  }, [] as string[])
  .join('\n')}

${
  this.dmmf.inputObjectTypes.model?.map((inputType) => new InputType(inputType, this.genericsInfo).toTS()).join('\n') ??
  ''
}

/**
 * Aliases for legacy arg types
 */
${context.defaultArgsAliases.generateAliases()}

/**
 * Batch Payload for updateMany & deleteMany & createMany
 */

export type BatchPayload = {
  count: number
}

/**
 * DMMF
 */
export const dmmf: runtime.BaseDMMF
`,
  2,
)}}`

    return code
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
}
