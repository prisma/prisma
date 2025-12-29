import { describe, expect, it } from 'vitest'

import { supportedInternalRuntimes } from '../../src/runtime-targets'
import { buildGetWasmModule, type BuildWasmModuleOptions as Options } from '../../src/utils/wasm'
import { assertTypeScriptIsValid } from '../assert-typescript-is-valid'

/**
 * Fixed input values for `buildGetWasmModule`.
 */

const ACTIVE_CONNECTOR_TYPE = 'postgresql' satisfies Options['activeProvider']
const RUNTIME_BASE = '.' satisfies Options['runtimeBase']

type MakeTypeScriptFilesInput = {
  output: string
}

function makeTypeScriptFiles({ output }: MakeTypeScriptFilesInput) {
  const CONFIG_BANNER = `let config = { compilerWasm: undefined } as
    {
      compilerWasm?: {
        getRuntime: () => Promise<unknown>
        getQueryCompilerWasmModule: () => Promise<WebAssembly.Module>
      }
    }
    `

  return {
    './buildGetWasmModule.ts': `${CONFIG_BANNER}${output}`,
    [`./query_compiler_fast_bg.postgresql.mjs`]: 'export const runtime = ``',
    [`./query_compiler_fast_bg.postgresql.js`]: 'module.exports = { runtime: `` }',
    [`./query_compiler_fast_bg.js`]: 'export const runtime = ``',
    [`./query_compiler_fast_bg.postgresql.wasm-base64.js`]: 'module.exports = { wasm: `` }\n',
    [`./query_compiler_fast_bg.postgresql.wasm-base64.mjs`]: 'export const wasm = ``\n',
  } as const
}

/**
 * Possible input values for `buildGetWasmModule`.
 */

const runtimeNames = ['client', 'wasm-compiler-edge'] as const satisfies Array<Options['runtimeName']>
const targets = supportedInternalRuntimes
const moduleFormats = ['cjs', 'esm'] as const satisfies Array<Options['moduleFormat']>

type CombinationName = `compiler-${Options['runtimeName']}-${Options['target']}-${Options['moduleFormat']}`

function makeTestCombinations() {
  const combinations: Array<Omit<Options, 'runtimeBase' | 'activeProvider'> & { testName: CombinationName }> = []

  for (const runtimeName of runtimeNames) {
    for (const target of targets) {
      // Skip impossible combinations
      if (['wasm-compiler-edge'].includes(runtimeName) && !['vercel-edge', 'workerd'].includes(target)) {
        continue
      }

      for (const moduleFormat of moduleFormats) {
        const testName = `compiler-${runtimeName}-${target}-${moduleFormat}` as const
        combinations.push({
          testName,
          runtimeName,
          target,
          moduleFormat,
        })
      }
    }
  }

  return combinations
}

const allCombinations = makeTestCombinations()

describe('buildGetWasmModule', () => {
  it.concurrent.each(allCombinations)(
    'generates valid TypeScript',
    ({ testName, moduleFormat, runtimeName, target }) => {
      const output = buildGetWasmModule({
        runtimeName,
        runtimeBase: RUNTIME_BASE,
        target,
        activeProvider: ACTIVE_CONNECTOR_TYPE,
        moduleFormat,
      })

      expect(output).toMatchSnapshot(`${testName}.ts`)

      assertTypeScriptIsValid({
        moduleFormat,
        files: makeTypeScriptFiles({ output }),
      })
    },
  )
})
