import fs from 'fs'
import path from 'path'
import { generateInFolder } from '../../utils/generateInFolder'
import rimraf from 'rimraf'
import { promisify } from 'util'
import { getPackedPackage } from '@prisma/sdk'
import { compileFile } from '../../utils/compileFile'
const del = promisify(rimraf)

jest.setTimeout(50000)

let packageSource: string
beforeAll(async () => {
  packageSource = (await getPackedPackage('@prisma/client')) as string
})

describe('valid types', () => {
  const subDirs = getSubDirs(__dirname)
  test.each(subDirs)('%s', async (dir) => {
    const testName = path.basename(dir)

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

    if (testName.startsWith('unhappy')) {
      await expect(compileFile(filePath)).rejects.toThrow()
    } else {
      await expect(compileFile(filePath)).resolves.not.toThrow()
    }
  })
})

function getSubDirs(dir: string): string[] {
  const files = fs.readdirSync(dir)
  return files
    .map((file) => path.join(dir, file))
    .filter((file) => fs.lstatSync(file).isDirectory())
}
