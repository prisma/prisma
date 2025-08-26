import { capitalize } from '@prisma/client-common'
import { TsConfigJson, TsConfigJsonResolved } from 'get-tsconfig'

import type { RuntimeTargetInternal } from './runtime-targets'

const expectedGeneratedFileExtensions = ['ts', 'mts', 'cts'] as const
export type GeneratedFileExtension = (typeof expectedGeneratedFileExtensions)[number] | (string & {})

const expectedImportFileExtensions = ['', 'ts', 'mts', 'cts', 'js', 'mjs', 'cjs'] as const
export type ImportFileExtension = (typeof expectedImportFileExtensions)[number] | (string & {})

type FileExtensionKind = 'generated' | 'import'

function validateFileExtension(extension: string, kind: FileExtensionKind, recommended: readonly string[]): string {
  if (!recommended.includes(extension) && !process.env.PRISMA_DISABLE_WARNINGS) {
    console.warn(
      `${capitalize(kind)} file extension ${JSON.stringify(
        extension,
      )} is unexpected and may be a mistake. Expected one of: ${recommended
        .map((ext) => JSON.stringify(ext))
        .join(', ')}`,
    )
  }
  return extension
}

function parseFileExtensionFromUnknown(
  extension: unknown,
  kind: FileExtensionKind,
  recommended: readonly string[],
): string {
  if (typeof extension === 'string') {
    return validateFileExtension(extension, kind, recommended)
  }
  throw new Error(`Invalid ${kind} file extension: ${JSON.stringify(extension)}, expected a string`)
}

export function parseGeneratedFileExtension(extension: unknown): GeneratedFileExtension {
  return parseFileExtensionFromUnknown(extension, 'generated', expectedGeneratedFileExtensions)
}

export function parseImportFileExtension(extension: unknown): ImportFileExtension {
  return parseFileExtensionFromUnknown(extension, 'import', expectedImportFileExtensions)
}

function extensionToSuffix(extension: string): string {
  return extension === '' ? '' : `.${extension}`
}

export type FileNameMapper = (baseName: string) => string

export function generatedFileNameMapper(generatedFileExtension: GeneratedFileExtension): FileNameMapper {
  return (baseName: string) => baseName + extensionToSuffix(generatedFileExtension)
}

export function importFileNameMapper(importFileExtension: ImportFileExtension): FileNameMapper {
  return (baseName: string) => baseName + extensionToSuffix(importFileExtension)
}

type InferImportFileExtensionOptions = {
  tsconfig: TsConfigJsonResolved | undefined
  generatedFileExtension: GeneratedFileExtension
  target: RuntimeTargetInternal
}

export function inferImportFileExtension({
  tsconfig,
  generatedFileExtension,
  target,
}: InferImportFileExtensionOptions): ImportFileExtension {
  if (target === 'deno') {
    return generatedFileExtension
  }

  // If `tsconfig.json` is present, we can infer the expected import file extension from it.
  if (tsconfig) {
    return inferImportFileExtensionFromTsConfig(tsconfig, generatedFileExtension)
  }

  // If there's no `tsconfig.json`, it means the generated code is going to be running under
  // Node.js 22+ with native type stripping, Deno, Bun, tsx or ts-node. In all of these cases,
  // using the original TS file extension is either supported or, in fact, required.
  return generatedFileExtension
}

function inferImportFileExtensionFromTsConfig(
  tsconfig: TsConfigJsonResolved,
  generatedFileExtension: GeneratedFileExtension,
): ImportFileExtension {
  // If the `tsconfig.json` allows importing TypeScript files using the `.ts`
  // extension, we must use exactly the same extension as the generated file.
  if (
    tsconfig.compilerOptions?.allowImportingTsExtensions ||
    // @ts-expect-error `get-tsconfig` types don't yet include the new option introduced in TypeScript 5.7
    (tsconfig.compilerOptions?.rewriteRelativeImportExtensions as boolean | undefined)
  ) {
    return generatedFileExtension
  }

  // Otherwise, we must either use the `.js`/`.mjs`/`.cjs` extension, or none at
  // all. The latter will only work when using a bundler, or when targeting
  // CommonJS. We use bare module specifiers without an extension when we are
  // sure it is supported, and fall back to the matching JavaScript extension
  // otherwise.

  const moduleResolution = tsconfig.compilerOptions?.moduleResolution?.toLowerCase() as
    | TsConfigJson.CompilerOptions.ModuleResolution
    | undefined

  const module = tsconfig.compilerOptions?.module?.toLowerCase() as TsConfigJson.CompilerOptions.Module | undefined

  if (module === 'commonjs' || moduleResolution === 'bundler') {
    return ''
  }

  return matchingJsExtension(generatedFileExtension)
}

function matchingJsExtension(generatedFileExtension: GeneratedFileExtension): ImportFileExtension {
  switch (generatedFileExtension) {
    case 'ts':
      return 'js'
    case 'mts':
      return 'mjs'
    case 'cts':
      return 'cjs'
    default:
      return generatedFileExtension
  }
}
