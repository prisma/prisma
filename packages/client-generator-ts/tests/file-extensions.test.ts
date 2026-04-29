import type { TsConfigJsonResolved } from 'get-tsconfig'
import { describe, expect, it } from 'vitest'

import { inferImportFileExtension } from '../src/file-extensions'

const bundlerTsConfig = {
  compilerOptions: {
    module: 'preserve',
    moduleResolution: 'bundler',
  },
} as TsConfigJsonResolved

describe('inferImportFileExtension', () => {
  it('keeps TypeScript extensions for cloudflare runtime in native Deno projects', () => {
    expect(
      inferImportFileExtension({
        tsconfig: bundlerTsConfig,
        generatedFileExtension: 'ts',
        target: 'workerd',
        hasDenoConfig: true,
      }),
    ).toBe('ts')
  })

  it('keeps bundler-style bare imports for non-Deno cloudflare projects', () => {
    expect(
      inferImportFileExtension({
        tsconfig: bundlerTsConfig,
        generatedFileExtension: 'ts',
        target: 'workerd',
      }),
    ).toBe('')
  })
})
