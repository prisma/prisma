import { DMMFHelper } from '@prisma/client-generator-common/dmmf'
import { GenerateContext as BaseGenerateContext } from '@prisma/client-generator-common/GenerateContext'
import { GenericArgsInfo } from '@prisma/client-generator-common/GenericsArgsInfo'
import { TypeBuilders } from '@prisma/client-generator-common/type-builders'
import { GeneratorConfig } from '@prisma/generator'

import { FileNameMapper } from '../file-extensions'

export interface GenerateContextOptions {
  dmmf: DMMFHelper
  genericArgsInfo: GenericArgsInfo
  runtimeImport: string
  outputFileName: FileNameMapper
  importFileName: FileNameMapper
  generator?: GeneratorConfig
}

export class GenerateContext implements GenerateContextOptions, BaseGenerateContext {
  dmmf: DMMFHelper
  genericArgsInfo: GenericArgsInfo
  runtimeImport: string
  outputFileName: FileNameMapper
  importFileName: FileNameMapper
  generator?: GeneratorConfig

  tsx = new TypeBuilders({
    Prisma: 'Prisma',
    Types: {
      self: 'runtime.Types',
      Extensions: 'runtime.Types.Extensions',
      Result: 'runtime.Types.Result',
      Utils: 'runtime.Types.Utils',
    },
  })

  constructor({
    dmmf,
    genericArgsInfo,
    runtimeImport,
    outputFileName,
    importFileName,
    generator,
  }: GenerateContextOptions) {
    this.dmmf = dmmf
    this.genericArgsInfo = genericArgsInfo
    this.runtimeImport = runtimeImport
    this.outputFileName = outputFileName
    this.importFileName = importFileName
    this.generator = generator
  }

  isPreviewFeatureOn(previewFeature: string): boolean {
    return this.generator?.previewFeatures?.includes(previewFeature) ?? false
  }
}
