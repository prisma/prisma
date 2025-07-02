import { capitalize } from '@prisma/client-common'
import { describe, expect, it } from 'vitest'

import { buildGetWasmModule, type BuildWasmModuleOptions as Options } from '../../src/utils/buildGetWasmModule'
import { assertTypeScriptIsValid } from '../assert-typescript-is-valid'

/**
 * Fixed input values for `buildGetWasmModule`.
 */

const ACTIVE_CONNECTOR_TYPE = 'postgresql' satisfies Options['activeProvider']
const RUNTIME_BASE = '.' satisfies Options['runtimeBase']

type MakeTypeScriptFilesInput = {
  component: Options['component']
  output: string
}

function makeTypeScriptFiles({ component, output }: MakeTypeScriptFilesInput) {
  const CONFIG_BANNER = `let config = { ${component}Wasm: undefined } as
    {
      ${component}Wasm?: {
        getRuntime: () => Promise<unknown>
        getQuery${capitalize(component)}WasmModule: () => Promise<WebAssembly.Module>
      }
    }
    `

  return {
    './buildGetWasmModule.ts': `${CONFIG_BANNER}${output}`,
    [`./query_${component}_bg.postgresql.mjs`]: 'export const runtime = ``',
  } as const
}

/**
 * Possible input values for `buildGetWasmModule`.
 */

const components = ['engine', 'compiler'] as const satisfies Array<Options['component']>
const runtimeNames = ['library', 'client', 'wasm-compiler-edge', 'edge'] as const satisfies Array<
  Options['runtimeName']
>
const targets = ['nodejs', 'edge-light', 'workerd', 'deno', 'bun'] as const satisfies Array<Options['target']>
const moduleFormats = ['cjs', 'esm'] as const satisfies Array<Options['moduleFormat']>

type CombinationName =
  `${Options['component']}-${Options['runtimeName']}-${Options['target']}-${Options['moduleFormat']}`

function makeTestCombinations() {
  const combinations: Array<Omit<Options, 'runtimeBase' | 'activeProvider'> & { testName: CombinationName }> = []

  for (const component of components) {
    for (const runtimeName of runtimeNames) {
      for (const target of targets) {
        for (const moduleFormat of moduleFormats) {
          const testName = `${component}-${runtimeName}-${target}-${moduleFormat}` as const
          combinations.push({
            testName,
            component,
            runtimeName,
            target,
            moduleFormat,
          })
        }
      }
    }
  }

  return combinations
}

const allCombinations = makeTestCombinations()

describe('buildGetWasmModule', () => {
  it.concurrent.each(allCombinations)(
    'generates valid TypeScript for: $testName',
    ({ testName, component, moduleFormat, runtimeName, target }) => {
      const output = buildGetWasmModule({
        component,
        runtimeName,
        runtimeBase: RUNTIME_BASE,
        target,
        activeProvider: ACTIVE_CONNECTOR_TYPE,
        moduleFormat,
      })

      expect(output).toMatchSnapshot(`buildGetWasmModule-${testName}.ts`)

      assertTypeScriptIsValid({
        moduleFormat,
        files: makeTypeScriptFiles({ component, output }),
      })
    },
  )
})
