import { ClientEngineType } from '@prisma/internals'
import fs from 'fs/promises'

import testMatrix from './_matrix'

const libraryRuntime = 'runtime/library'
const binaryRuntime = 'runtime/binary'
const edgeRuntime = 'runtime/edge'
const nftAnnotation = '// file annotations for bundling tools'

testMatrix.setupTestSuite(({ engineType }, suiteMeta, clientMeta) => {
  test('imports correct runtime', async () => {
    const clientModule = clientMeta.runtime === 'edge' ? '@prisma/client/edge' : '@prisma/client'
    const clientModuleEntryPoint = require.resolve(clientModule, { paths: [suiteMeta.generatedFolder] })
    const generatedClientContents = await fs.readFile(clientModuleEntryPoint, 'utf-8')

    if (clientMeta.dataProxy && clientMeta.runtime === 'edge') {
      expect(generatedClientContents).toContain(edgeRuntime)
      expect(generatedClientContents).not.toContain(libraryRuntime)
      expect(generatedClientContents).not.toContain(binaryRuntime)
    } else if (clientMeta.dataProxy && engineType === ClientEngineType.Library) {
      expect(generatedClientContents).toContain(libraryRuntime)
      expect(generatedClientContents).not.toContain(edgeRuntime)
      expect(generatedClientContents).not.toContain(binaryRuntime)
    } else if (clientMeta.dataProxy && engineType === ClientEngineType.Binary) {
      expect(generatedClientContents).toContain(binaryRuntime)
      expect(generatedClientContents).not.toContain(edgeRuntime)
      expect(generatedClientContents).not.toContain(libraryRuntime)
    } else if (engineType === ClientEngineType.Library) {
      expect(generatedClientContents).toContain(libraryRuntime)
      expect(generatedClientContents).not.toContain(edgeRuntime)
      expect(generatedClientContents).not.toContain(binaryRuntime)
    } else if (engineType === ClientEngineType.Binary) {
      expect(generatedClientContents).toContain(binaryRuntime)
      expect(generatedClientContents).not.toContain(edgeRuntime)
      expect(generatedClientContents).not.toContain(libraryRuntime)
    } else if (engineType === ClientEngineType.Wasm && clientMeta.runtime === 'node') {
      expect(generatedClientContents).toContain(libraryRuntime)
      expect(generatedClientContents).not.toContain(edgeRuntime)
      expect(generatedClientContents).not.toContain(binaryRuntime)
    } else if (engineType === ClientEngineType.Wasm && clientMeta.runtime === 'edge') {
      expect(generatedClientContents).toContain(edgeRuntime)
      expect(generatedClientContents).not.toContain(libraryRuntime)
      expect(generatedClientContents).not.toContain(binaryRuntime)
    } else {
      throw new Error('Unhandled case')
    }
  })

  test('imported files have the expected annotations', async () => {
    const clientModule = clientMeta.runtime === 'edge' ? '@prisma/client/edge' : '@prisma/client'
    const clientModuleEntryPoint = require.resolve(clientModule, { paths: [suiteMeta.generatedFolder] })
    const generatedClientContents = await fs.readFile(clientModuleEntryPoint, 'utf-8')

    if (clientMeta.dataProxy && clientMeta.runtime === 'edge') {
      expect(generatedClientContents).not.toContain(nftAnnotation)
    } else if (clientMeta.dataProxy && engineType === ClientEngineType.Library) {
      expect(generatedClientContents).not.toContain(nftAnnotation)
    } else if (clientMeta.dataProxy && engineType === ClientEngineType.Binary) {
      expect(generatedClientContents).not.toContain(nftAnnotation)
    } else if (engineType === ClientEngineType.Library) {
      expect(generatedClientContents).toContain(nftAnnotation)
    } else if (engineType === ClientEngineType.Binary) {
      expect(generatedClientContents).toContain(nftAnnotation)
    } else if (engineType === ClientEngineType.Wasm && clientMeta.runtime === 'node') {
      expect(generatedClientContents).toContain(nftAnnotation)
    } else if (engineType === ClientEngineType.Wasm && clientMeta.runtime === 'edge') {
      expect(generatedClientContents).not.toContain(nftAnnotation)
    } else {
      throw new Error('Unhandled case')
    }
  })
})
