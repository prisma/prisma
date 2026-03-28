import fs from 'fs/promises'
import { createRequire } from 'module'
import os from 'os'
import path from 'path'

import { cliTypesStubContents, writeCliTypesStub } from '../../helpers/writeCliTypesStub'

const cliPackageJson = require('../../package.json')

describe('prisma package exports', () => {
  it('keeps the root export resolvable for CommonJS tooling', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prisma-cli-exports-'))
    const consumerDir = path.join(tempDir, 'consumer')
    const packageDir = path.join(consumerDir, 'node_modules', 'prisma')
    const rootExportPath = cliPackageJson.exports['.'].require.default
    const resolvedExportPath = rootExportPath.replace('./', '')

    try {
      await fs.mkdir(packageDir, { recursive: true })
      await fs.writeFile(path.join(packageDir, 'package.json'), JSON.stringify(cliPackageJson, null, 2))
      await writeCliTypesStub(path.join(packageDir, path.dirname(resolvedExportPath)))

      const requireFromConsumer = createRequire(path.join(consumerDir, 'package.json'))
      const resolvedPackagePath = requireFromConsumer.resolve('prisma')

      expect(cliPackageJson.exports['.'].import.default).toBe(rootExportPath)
      expect(cliPackageJson.exports['.'].default).toBe(rootExportPath)
      expect(resolvedPackagePath).toBe(path.join(packageDir, resolvedExportPath))
      expect(await fs.readFile(resolvedPackagePath, 'utf8')).toBe(cliTypesStubContents)
      expect(requireFromConsumer('prisma')).toEqual({})
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  })
})
