import crypto from 'node:crypto'
import path from 'node:path'

import type { GetPrismaClientConfig } from '@prisma/client-common'
import { datamodelEnumToSchemaEnum } from '@prisma/dmmf'
import type { BinaryTarget } from '@prisma/get-platform'
import { ClientEngineType, getClientEngineType, pathToPosix } from '@prisma/internals'
import * as ts from '@prisma/ts-builders'
import ciInfo from 'ci-info'
import indent from 'indent-string'
import type { O } from 'ts-toolbelt'

import { DMMFHelper } from '../dmmf'
import { GenerateClientOptions } from '../generateClient'
import { GenericArgsInfo } from '../GenericsArgsInfo'
import { buildDebugInitialization } from '../utils/buildDebugInitialization'
import { buildDirname } from '../utils/buildDirname'
import { buildRuntimeDataModel } from '../utils/buildDMMF'
import { buildGetWasmModule } from '../utils/buildGetWasmModule'
import { buildInjectableEdgeEnv } from '../utils/buildInjectableEdgeEnv'
import { buildNFTAnnotations } from '../utils/buildNFTAnnotations'
import { commonCodeTS } from './common'
import { Count } from './Count'
import { Enum } from './Enum'
import { FieldRefInput } from './FieldRefInput'
import { type Generable } from './Generable'
import { GenerateContext } from './GenerateContext'
import { InputType } from './Input'
import { Model } from './Model'
import { PrismaClientClass } from './PrismaClient'

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
    })

    const prismaClientClass = new PrismaClientClass(
      context,
      this.options.datasources,
      this.options.outputDir,
      this.options.runtimeName,
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
    for (const datamodelEnum of this.dmmf.datamodel.enums) {
      modelEnums.push(new Enum(datamodelEnumToSchemaEnum(datamodelEnum), false).toTS())
      modelEnumsAliases.push(
        ts.stringify(
          ts.moduleExport(ts.typeDeclaration(datamodelEnum.name, ts.namedType(`$Enums.${datamodelEnum.name}`))),
        ),
        ts.stringify(
          ts.moduleExport(
            ts.constDeclaration(datamodelEnum.name).setValue(ts.namedValue(`$Enums.${datamodelEnum.name}`)),
          ),
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
 */

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

${clientConfig}

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
      acc.push(new InputType(inputType, context).overrideName(`${inputType.name}Base`).toTS())
    } else {
      acc.push(new InputType(inputType, context).toTS())
    }
    return acc
  }, [] as string[])
  .join('\n')}

${this.dmmf.inputObjectTypes.model?.map((inputType) => new InputType(inputType, context).toTS()).join('\n') ?? ''}

/**
 * Batch Payload for updateMany & deleteMany & createMany
 */

export type BatchPayload = {
  count: number
}
`,
  2,
)}}`

    return code
  }
}
