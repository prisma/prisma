import { ClientEngineType } from '@prisma/internals'
import fs from 'node:fs/promises'
import path from 'node:path'

import testMatrix from './_matrix'

const libraryRuntime = 'runtime/library'
const binaryRuntime = 'runtime/binary'
const edgeRuntime = 'runtime/edge'
const wasmRuntime = 'runtime/wasm'
const nftAnnotation = '// file annotations for bundling tools'
const wasmFileUsage = '#wasm-engine-loader'

testMatrix.setupTestSuite(
  ({ engineType, clientRuntime }, suiteMeta, clientMeta) => {
    const clientEntrypoint = `@prisma/client/${clientRuntime === 'node' ? 'index' : clientRuntime}.js`
    const clientEntrypointPath = path.join(suiteMeta.generatedFolder, 'node_modules', clientEntrypoint)

    test('imports correct runtime', async () => {
      const generatedClientContents = await fs.readFile(clientEntrypointPath, 'utf-8')

      if (clientMeta.dataProxy && clientRuntime === 'edge') {
        expect(generatedClientContents).toContain(edgeRuntime)
        expect(generatedClientContents).not.toContain(libraryRuntime)
        expect(generatedClientContents).not.toContain(binaryRuntime)
        expect(generatedClientContents).not.toContain(wasmRuntime)
      } else if (clientMeta.dataProxy && engineType === ClientEngineType.Library) {
        expect(generatedClientContents).toContain(libraryRuntime)
        expect(generatedClientContents).not.toContain(edgeRuntime)
        expect(generatedClientContents).not.toContain(binaryRuntime)
        expect(generatedClientContents).not.toContain(wasmRuntime)
      } else if (clientMeta.dataProxy && engineType === ClientEngineType.Binary) {
        expect(generatedClientContents).toContain(binaryRuntime)
        expect(generatedClientContents).not.toContain(edgeRuntime)
        expect(generatedClientContents).not.toContain(libraryRuntime)
        expect(generatedClientContents).not.toContain(wasmRuntime)
      } else if (engineType === ClientEngineType.Library && clientRuntime === 'node') {
        expect(generatedClientContents).toContain(libraryRuntime)
        expect(generatedClientContents).not.toContain(edgeRuntime)
        expect(generatedClientContents).not.toContain(binaryRuntime)
        expect(generatedClientContents).not.toContain(wasmRuntime)
      } else if (engineType === ClientEngineType.Binary && clientRuntime === 'node') {
        expect(generatedClientContents).toContain(binaryRuntime)
        expect(generatedClientContents).not.toContain(edgeRuntime)
        expect(generatedClientContents).not.toContain(libraryRuntime)
        expect(generatedClientContents).not.toContain(wasmRuntime)
      } else if (clientMeta.driverAdapter && clientRuntime === 'node') {
        expect(generatedClientContents).toContain(libraryRuntime)
        expect(generatedClientContents).not.toContain(edgeRuntime)
        expect(generatedClientContents).not.toContain(binaryRuntime)
        expect(generatedClientContents).not.toContain(wasmRuntime)
      } else if (clientMeta.driverAdapter && clientRuntime === 'edge') {
        expect(generatedClientContents).toContain(edgeRuntime)
        expect(generatedClientContents).not.toContain(libraryRuntime)
        expect(generatedClientContents).not.toContain(binaryRuntime)
        expect(generatedClientContents).not.toContain(wasmRuntime)
      } else if (clientMeta.driverAdapter && clientRuntime === 'wasm') {
        expect(generatedClientContents).toContain(wasmRuntime)
        expect(generatedClientContents).not.toContain(libraryRuntime)
        expect(generatedClientContents).not.toContain(binaryRuntime)
        expect(generatedClientContents).not.toContain(edgeRuntime)
      } else {
        throw new Error('Unhandled case')
      }
    })

    test('imported files have the expected annotations', async () => {
      const generatedClientContents = await fs.readFile(clientEntrypointPath, 'utf-8')

      if (clientMeta.dataProxy && clientRuntime === 'edge') {
        expect(generatedClientContents).not.toContain(nftAnnotation)
        expect(generatedClientContents).not.toContain(wasmFileUsage)
      } else if (clientMeta.dataProxy && engineType === ClientEngineType.Library) {
        expect(generatedClientContents).not.toContain(nftAnnotation)
        expect(generatedClientContents).not.toContain(wasmFileUsage)
      } else if (clientMeta.dataProxy && engineType === ClientEngineType.Binary) {
        expect(generatedClientContents).not.toContain(nftAnnotation)
        expect(generatedClientContents).not.toContain(wasmFileUsage)
      } else if (engineType === ClientEngineType.Library && clientRuntime === 'node') {
        expect(generatedClientContents).toContain(nftAnnotation)
        expect(generatedClientContents).not.toContain(wasmFileUsage)
      } else if (engineType === ClientEngineType.Binary && clientRuntime === 'node') {
        expect(generatedClientContents).toContain(nftAnnotation)
        expect(generatedClientContents).not.toContain(wasmFileUsage)
      } else if (clientMeta.driverAdapter && clientRuntime === 'node') {
        expect(generatedClientContents).toContain(nftAnnotation)
        expect(generatedClientContents).not.toContain(wasmFileUsage)
      } else if (clientMeta.driverAdapter && clientRuntime === 'edge') {
        expect(generatedClientContents).not.toContain(nftAnnotation)
        expect(generatedClientContents).not.toContain(wasmFileUsage)
      } else if (clientMeta.driverAdapter && clientRuntime === 'wasm') {
        expect(generatedClientContents).not.toContain(nftAnnotation)
        expect(generatedClientContents).toContain(wasmFileUsage)
      } else {
        throw new Error('Unhandled case')
      }
    })
  },
  {
    skipDefaultClientInstance: true,
  },
)
