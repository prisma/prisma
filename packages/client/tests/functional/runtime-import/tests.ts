import fs from 'fs/promises'
import path from 'path'

import testMatrix from './_matrix'

const libraryRuntime = 'runtime/library'
const binaryRuntime = 'runtime/binary'
const edgeRuntime = 'runtime/edge'
const wasmRuntime = 'runtime/wasm-engine-edge'
const nftAnnotation = '// file annotations for bundling tools'
const wasmFileUsage = '#wasm-engine-loader'

testMatrix.setupTestSuite(
  ({ clientRuntime, generatorType }, suiteMeta, clientMeta) => {
    const clientEntrypoint = `generated/prisma/client/${clientRuntime === 'node' ? 'index' : clientRuntime}.js`
    const clientEntrypointPath = path.join(suiteMeta.generatedFolder, clientEntrypoint)

    describeIf(generatorType === 'prisma-client-js')('runtime bundles in JS client', () => {
      test('imports correct runtime', async () => {
        const generatedClientContents = await fs.readFile(clientEntrypointPath, 'utf-8')

        if (clientMeta.driverAdapter && clientRuntime === 'node') {
          expect(generatedClientContents).toContain(libraryRuntime)
          expect(generatedClientContents).not.toContain(edgeRuntime)
          expect(generatedClientContents).not.toContain(binaryRuntime)
          expect(generatedClientContents).not.toContain(wasmRuntime)
        } else {
          throw new Error('Unhandled case')
        }
      })

      test('imported files have the expected annotations', async () => {
        const generatedClientContents = await fs.readFile(clientEntrypointPath, 'utf-8')

        if (clientMeta.driverAdapter && clientRuntime === 'node') {
          expect(generatedClientContents).toContain(nftAnnotation)
          expect(generatedClientContents).not.toContain(wasmFileUsage)
        } else {
          throw new Error('Unhandled case')
        }
      })
    })
  },
  {
    skipDefaultClientInstance: true,
  },
)
