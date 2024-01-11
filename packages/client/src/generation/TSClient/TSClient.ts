import type { DataSource, GeneratorConfig } from '@prisma/generator-helper'
import type { BinaryTarget } from '@prisma/get-platform'
import { getClientEngineType, getEnvPaths, pathToPosix } from '@prisma/internals'
import ciInfo from 'ci-info'
import crypto from 'crypto'
import { readFile } from 'fs/promises'
import indent from 'indent-string'
import { klona } from 'klona'
import path from 'path'

import type { GetPrismaClientConfig } from '../../runtime/getPrismaClient'
import { DMMFHelper } from '../dmmf'
import type { DMMF } from '../dmmf-types'
import { GenericArgsInfo } from '../GenericsArgsInfo'
import * as ts from '../ts-builders'
import { buildDebugInitialization } from '../utils/buildDebugInitialization'
import { buildDirname } from '../utils/buildDirname'
import { buildRuntimeDataModel } from '../utils/buildDMMF'
import { buildGetQueryEngineWasmModule } from '../utils/buildGetQueryEngineWasmModule'
import { buildInjectableEdgeEnv } from '../utils/buildInjectableEdgeEnv'
import { buildNFTAnnotations } from '../utils/buildNFTAnnotations'
import { buildRequirePath } from '../utils/buildRequirePath'
import { buildWarnEnvConflicts } from '../utils/buildWarnEnvConflicts'
import { commonCodeJS, commonCodeTS } from './common'
import { Count } from './Count'
import { DefaultArgsAliases } from './DefaultArgsAliases'
import { Enum } from './Enum'
import { FieldRefInput } from './FieldRefInput'
import type { Generatable } from './Generatable'
import { GenerateContext } from './GenerateContext'
import { InputType } from './Input'
import { Model } from './Model'
import { PrismaClientClass } from './PrismaClient'

export interface TSClientOptions {
  projectRoot: string
  clientVersion: string
  engineVersion: string
  document: DMMF.Document
  runtimeDir: string
  runtimeName: string
  browser?: boolean
  datasources: DataSource[]
  generator?: GeneratorConfig
  binaryTargets?: BinaryTarget[] // TODO: consider making it non-nullable
  schemaPath: string
  outputDir: string
  activeProvider: string
  deno?: boolean
  postinstall?: boolean
  noEngine?: boolean
}

export class TSClient implements Generatable {
  protected readonly dmmf: DMMFHelper
  protected readonly genericsInfo: GenericArgsInfo

  static enabledPreviewFeatures: string[]

  constructor(protected readonly options: TSClientOptions) {
    this.dmmf = new DMMFHelper(klona(options.document))
    this.genericsInfo = new GenericArgsInfo(this.dmmf)

    TSClient.enabledPreviewFeatures = this.options.generator?.previewFeatures ?? []
  }

  public async toJS(edge = false): Promise<string> {
    const { binaryTargets, generator, outputDir, schemaPath, runtimeDir, runtimeName, datasources, deno, noEngine } =
      this.options
    const envPaths = getEnvPaths(schemaPath, { cwd: outputDir })

    const relativeEnvPaths = {
      rootEnvPath: envPaths.rootEnvPath && pathToPosix(path.relative(outputDir, envPaths.rootEnvPath)),
      schemaEnvPath: envPaths.schemaEnvPath && pathToPosix(path.relative(outputDir, envPaths.schemaEnvPath)),
    }

    // This ensures that any engine override is propagated to the generated clients config
    const engineType = getClientEngineType(generator!)
    if (generator) {
      generator.config.engineType = engineType
    }

    const inlineSchema = (await readFile(schemaPath)).toString('base64')
    const inlineSchemaHash = crypto.createHash('sha256').update(inlineSchema).digest('hex')
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
      noEngine,
    }

    // get relative output dir for it to be preserved even after bundling, or
    // being moved around as long as we keep the same project dir structure.
    const relativeOutdir = path.relative(process.cwd(), outputDir)

    const code = `${commonCodeJS({ ...this.options, browser: false })}
${buildRequirePath(edge)}

/**
 * Enums
 */
${this.dmmf.schema.enumTypes.prisma.map((type) => new Enum(type, true).toJS()).join('\n\n')}
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
${buildRuntimeDataModel(this.dmmf.datamodel)}
${buildGetQueryEngineWasmModule(edge, engineType)}
${buildInjectableEdgeEnv(edge, datasources)}
${buildWarnEnvConflicts(edge, runtimeDir, runtimeName)}
${buildDebugInitialization(edge)}
const PrismaClient = getPrismaClient(config)
exports.PrismaClient = PrismaClient
Object.assign(exports, Prisma)${deno ? '\nexport { exports as default, Prisma, PrismaClient }' : ''}
${buildNFTAnnotations(Boolean(edge || noEngine), engineType, binaryTargets, relativeOutdir)}
`
    return code
  }
  public toTS(edge = false): string {
    // edge exports the same ts definitions as the index
    if (edge === true) return `export * from './index'`

    const context: GenerateContext = {
      dmmf: this.dmmf,
      genericArgsInfo: this.genericsInfo,
      generator: this.options.generator,
      defaultArgsAliases: new DefaultArgsAliases(),
    }

    const prismaClientClass = new PrismaClientClass(
      this.dmmf,
      this.options.datasources,
      this.options.outputDir,
      this.options.runtimeName,
      this.options.browser,
      this.options.generator,
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

    const prismaEnums = this.dmmf.schema.enumTypes.prisma.map((type) => new Enum(type, true).toTS())

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
      .filter((t) => t.name.endsWith('CountOutputType'))
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

${prismaEnums.join('\n\n')}
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
  .reduce((acc, inputType) => {
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
      runtimeName: 'index-browser',
      browser: true,
    })}
/**
 * Enums
 */

${this.dmmf.schema.enumTypes.prisma.map((type) => new Enum(type, true).toJS()).join('\n\n')}
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
        const runtime = detectRuntime()
        const edgeRuntimeName = {
          'workerd': 'Cloudflare Workers',
          'deno': 'Deno and Deno Deploy',
          'netlify': 'Netlify Edge Functions',
          'edge-light': 'Vercel Edge Functions',
        }[runtime]

        let message = 'PrismaClient is unable to run in '
        if (edgeRuntimeName !== undefined) {
          message += edgeRuntimeName + '. As an alternative, try Accelerate: https://pris.ly/d/accelerate.'
        } else {
          message += 'this browser environment, or has been bundled for the browser (running in \`' + runtime + '\`).'
        }
        
        message += \`
If this is unexpected, please open an issue: https://github.com/prisma/prisma/issues\`

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
