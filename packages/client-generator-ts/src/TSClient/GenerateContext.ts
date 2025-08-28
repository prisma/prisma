import { GeneratorConfig } from '@prisma/generator'

import { DMMFHelper } from '../dmmf'
import { FileNameMapper } from '../file-extensions'
import { GenericArgsInfo } from '../GenericsArgsInfo'

export interface GenerateContextOptions {
  dmmf: DMMFHelper
  genericArgsInfo: GenericArgsInfo
  runtimeBase: string
  runtimeImport: string
  outputFileName: FileNameMapper
  importFileName: FileNameMapper
  generator?: GeneratorConfig
}

export class GenerateContext implements GenerateContextOptions {
  dmmf: DMMFHelper
  genericArgsInfo: GenericArgsInfo
  runtimeBase: string
  runtimeImport: string
  outputFileName: FileNameMapper
  importFileName: FileNameMapper
  generator?: GeneratorConfig

  constructor({
    dmmf,
    genericArgsInfo,
    runtimeBase,
    runtimeImport,
    outputFileName,
    importFileName,
    generator,
  }: GenerateContextOptions) {
    this.dmmf = dmmf
    this.genericArgsInfo = genericArgsInfo
    this.runtimeBase = runtimeBase
    this.runtimeImport = runtimeImport
    this.outputFileName = outputFileName
    this.importFileName = importFileName
    this.generator = generator
  }

  isPreviewFeatureOn(previewFeature: string): boolean {
    return this.generator?.previewFeatures?.includes(previewFeature) ?? false
  }
}
