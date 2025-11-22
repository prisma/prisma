import { PrismaClientInitializationError } from '@prisma/client-runtime-utils'

import { wasmQueryCompilerLoader } from '../../runtime/core/engines/client/WasmQueryCompilerLoader'

describe('wasmQueryCompilerLoader with blocked WASM compilation', () => {
  const originalWebAssembly = globalThis.WebAssembly

  beforeAll(() => {
    const CompileErrorCtor = class extends Error {
      constructor(message: string) {
        super(message)
        this.name = 'CompileError'
      }
    }

    // Mock WebAssembly to throw the Cloudflare Workers error
    ;(globalThis as any).WebAssembly = {
      ...originalWebAssembly,
      CompileError: CompileErrorCtor,
      Instance: class {
        constructor() {
          throw new CompileErrorCtor('Wasm code generation disallowed by embedder')
        }
      },
    }
  })

  afterAll(() => {
    globalThis.WebAssembly = originalWebAssembly
  })

  it('throws PrismaClientInitializationError when WASM compilation is blocked', async () => {
    const mockCompilerWasm = {
      getRuntime: () =>
        Promise.resolve({
          __wbg_set_wasm: jest.fn(),
          QueryCompiler: {} as any,
        }),
      getQueryCompilerWasmModule: () => Promise.resolve({} as any),
    }

    const config: any = {
      clientVersion: '7.0.0',
      compilerWasm: mockCompilerWasm,
      activeProvider: 'postgresql',
    }

    await expect(wasmQueryCompilerLoader.loadQueryCompiler(config)).rejects.toThrow(PrismaClientInitializationError)

    await expect(wasmQueryCompilerLoader.loadQueryCompiler(config)).rejects.toThrow(
      /blocks dynamic WebAssembly compilation/i,
    )
  })
})
