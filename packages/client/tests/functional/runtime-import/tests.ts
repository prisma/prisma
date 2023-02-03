import { ClientEngineType, getClientEngineType } from '@prisma/internals'
import fs from 'fs/promises'

import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

const libraryRuntime = 'runtime/library'
const binaryRuntime = 'runtime/binary'
const dataProxyRuntime = 'runtime/data-proxy'
const edgeRuntime = 'runtime/edge'

testMatrix.setupTestSuite((suiteConfig, suiteMeta, clientMeta) => {
  test('imports correct runtime', async () => {
    const clientModule = clientMeta.runtime === 'edge' ? '@prisma/client/edge' : '@prisma/client'
    const clientModuleEntryPoint = require.resolve(clientModule, { paths: [suiteMeta.generatedFolder] })
    const generatedClientContents = await fs.readFile(clientModuleEntryPoint, 'utf-8')

    if (clientMeta.runtime === 'edge') {
      expect(generatedClientContents).toContain(edgeRuntime)
      expect(generatedClientContents).not.toContain(dataProxyRuntime)
      expect(generatedClientContents).not.toContain(libraryRuntime)
      expect(generatedClientContents).not.toContain(binaryRuntime)
    } else if (clientMeta.dataProxy) {
      expect(generatedClientContents).toContain(dataProxyRuntime)
      expect(generatedClientContents).not.toContain(binaryRuntime)
      expect(generatedClientContents).not.toContain(libraryRuntime)
      expect(generatedClientContents).not.toContain(edgeRuntime)
    } else if (getClientEngineType() === ClientEngineType.Library) {
      expect(generatedClientContents).toContain(libraryRuntime)
      expect(generatedClientContents).not.toContain(binaryRuntime)
      expect(generatedClientContents).not.toContain(dataProxyRuntime)
      expect(generatedClientContents).not.toContain(edgeRuntime)
    } else if (getClientEngineType() === ClientEngineType.Binary) {
      expect(generatedClientContents).toContain(binaryRuntime)
      expect(generatedClientContents).not.toContain(libraryRuntime)
      expect(generatedClientContents).not.toContain(dataProxyRuntime)
      expect(generatedClientContents).not.toContain(edgeRuntime)
    }
  })
})
