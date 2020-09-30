import fs from 'fs'
import path from 'path'
import { generateInFolder } from '../../utils/generateInFolder'
import { compileFile } from '../../utils/compileFile'
import rimraf from 'rimraf'
import { promisify } from 'util'
import { getPackedPackage } from '@prisma/sdk'
const del = promisify(rimraf)

jest.setTimeout(30000)

let packageSource: string
beforeAll(async () => {
  packageSource = (await getPackedPackage('@prisma/client')) as string
})

describe('valid types', () => {
  const subDirs = getSubDirs(__dirname)
  for (const dir of subDirs) {
    const testName = path.basename(dir)

    test(testName, async () => {
      const nodeModules = path.join(dir, 'node_modules')
      if (fs.existsSync(nodeModules)) {
        await del(nodeModules)
      }
      await generateInFolder({
        projectDir: dir,
        useLocalRuntime: false,
        transpile: true,
        packageSource,
      })
      const filePath = path.join(dir, 'index.ts')
      expect(() => compileFile(filePath)).not.toThrow()
    })
  }
})

function getSubDirs(dir: string): string[] {
  const files = fs.readdirSync(dir)
  return files
    .map((file) => path.join(dir, file))
    .filter((file) => fs.lstatSync(file).isDirectory())
}
