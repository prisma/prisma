import fs from 'fs'
import path from 'path'

import testMatrix from './_matrix'

const dtsFile = path.resolve(__dirname, '..', '..', '..', 'runtime', 'index.d.ts')
const dtsContents = fs.readFileSync(dtsFile, 'utf8')

testMatrix.setupTestSuite(
  () => {
    test('does not contain reference to node types', () => {
      expect(dtsContents).not.toContain('/// <reference types="node" />')
    })

    test('does not import other types', () => {
      expect(dtsContents).not.toMatch(/^import type/gm)
    })
  },
  {
    skipDb: true,
    skipDefaultClientInstance: true,
    optOut: {
      from: ['postgresql', 'mysql', 'mongodb', 'cockroachdb', 'sqlserver'],
      reason: 'Test checks runtime file that is statically build and does not depend on  provider',
    },
  },
)
