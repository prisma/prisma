import fs from 'fs'
import path from 'path'
import { generateInFolder } from '../../utils/generateInFolder'
import { compileFile } from '../../utils/compileFile'
import rimraf from 'rimraf'
import { promisify } from 'util'
import { getPackedPackage } from '@prisma/sdk'
import Piscina from 'piscina'
const del = promisify(rimraf)

jest.setTimeout(30000)

let packageSource: string
beforeAll(async () => {
  packageSource = (await getPackedPackage('@prisma/client')) as string
})

const piscina = new Piscina({
  filename: path.resolve(__dirname, 'compilerWorker.js'),
})

describe('valid types', () => {
  const subDirs = getSubDirs(__dirname)
  test.concurrent.each(subDirs)('%s', async (dir) => {
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
      await expect(piscina.runTask(filePath)).rejects.toThrow()
    } else {
      await expect(piscina.runTask(filePath)).resolves.not.toThrow()
    }
  })
})

function getSubDirs(dir: string): string[] {
  const files = fs.readdirSync(dir)
  return files
    .map((file) => path.join(dir, file))
    .filter((file) => fs.lstatSync(file).isDirectory())
}
