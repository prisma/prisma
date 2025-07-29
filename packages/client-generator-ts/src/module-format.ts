import { TsConfigJson, TsConfigJsonResolved } from 'get-tsconfig'

import { GeneratedFileExtension } from './file-extensions'

const moduleFormats = ['esm', 'cjs'] as const

export type ModuleFormat = (typeof moduleFormats)[number]

export function parseModuleFormat(format: string): ModuleFormat {
  switch (format.toLowerCase()) {
    case 'cjs':
    case 'commonjs':
      return 'cjs'
    case 'esm':
      return 'esm'
    default:
      throw new Error(`Invalid module format: "${format}", expected "esm" or "cjs"`)
  }
}

export function parseModuleFormatFromUnknown(value: unknown): ModuleFormat {
  if (typeof value === 'string') {
    return parseModuleFormat(value)
  } else {
    throw new Error(`Invalid module format: ${JSON.stringify(value)}, expected "esm" or "cjs"`)
  }
}

type InferModuleFormatOptions = {
  tsconfig: TsConfigJsonResolved | undefined
  generatedFileExtension: GeneratedFileExtension
  importFileExtension: GeneratedFileExtension
}

export function inferModuleFormat({
  tsconfig,
  generatedFileExtension,
  importFileExtension,
}: InferModuleFormatOptions): ModuleFormat {
  if (tsconfig?.compilerOptions?.module) {
    return fromTsConfigModule(tsconfig.compilerOptions.module)
  }

  if (generatedFileExtension === 'cts' || importFileExtension === 'cjs') {
    return 'cjs'
  }

  return 'esm'
}

function fromTsConfigModule(module: TsConfigJson.CompilerOptions.Module) {
  const normalizedModule = module.toLowerCase() as TsConfigJson.CompilerOptions.Module

  if (normalizedModule === 'commonjs') {
    return 'cjs'
  }

  return 'esm'
}
