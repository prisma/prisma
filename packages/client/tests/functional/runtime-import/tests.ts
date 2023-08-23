import { ClientEngineType, getClientEngineType } from '@prisma/internals'
import fs from 'fs/promises'

import testMatrix from './_matrix'

const libraryRuntime = 'runtime/library'
const binaryRuntime = 'runtime/binary'
const edgeRuntime = 'runtime/edge'
const nftAnnotation = '// file annotations for bundling tools'

testMatrix.setupTestSuite((suiteConfig, suiteMeta, clientMeta) => {
  test('imports correct runtime', async () => {
    const clientModule = clientMeta.runtime === 'edge' ? '@prisma/client/edge' : '@prisma/client'
    const clientModuleEntryPoint = require.resolve(clientModule, { paths: [suiteMeta.generatedFolder] })
    const generatedClientContents = await fs.readFile(clientModuleEntryPoint, 'utf-8')

    if (clientMeta.dataProxy && clientMeta.runtime === 'edge') {
      expect(generatedClientContents).toContain(edgeRuntime)
      expect(generatedClientContents).not.toContain(libraryRuntime)
      expect(generatedClientContents).not.toContain(binaryRuntime)
    } else if (clientMeta.dataProxy && getClientEngineType() === ClientEngineType.Library) {
      expect(generatedClientContents).toContain(libraryRuntime)
      expect(generatedClientContents).not.toContain(edgeRuntime)
      expect(generatedClientContents).not.toContain(binaryRuntime)
    } else if (clientMeta.dataProxy && getClientEngineType() === ClientEngineType.Binary) {
      expect(generatedClientContents).toContain(binaryRuntime)
      expect(generatedClientContents).not.toContain(edgeRuntime)
      expect(generatedClientContents).not.toContain(libraryRuntime)
    } else if (getClientEngineType() === ClientEngineType.Library) {
      expect(generatedClientContents).toContain(libraryRuntime)
      expect(generatedClientContents).not.toContain(edgeRuntime)
      expect(generatedClientContents).not.toContain(binaryRuntime)
    } else if (getClientEngineType() === ClientEngineType.Binary) {
      expect(generatedClientContents).toContain(binaryRuntime)
      expect(generatedClientContents).not.toContain(edgeRuntime)
      expect(generatedClientContents).not.toContain(libraryRuntime)
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
    } else if (clientMeta.dataProxy && getClientEngineType() === ClientEngineType.Library) {
      expect(generatedClientContents).not.toContain(nftAnnotation)
    } else if (clientMeta.dataProxy && getClientEngineType() === ClientEngineType.Binary) {
      expect(generatedClientContents).not.toContain(nftAnnotation)
    } else if (getClientEngineType() === ClientEngineType.Library) {
      expect(generatedClientContents).toContain(nftAnnotation)
    } else if (getClientEngineType() === ClientEngineType.Binary) {
      expect(generatedClientContents).toContain(nftAnnotation)
    } else {
      throw new Error('Unhandled case')
    }
  })
})
