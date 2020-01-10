import fs from 'fs'
import path from 'path'
import { generateInFolder } from '../../utils/generateInFolder'
import { promisify } from 'util'
import rimraf from 'rimraf'
const del = promisify(rimraf)

jest.setTimeout(30000)

describe('runtime works', () => {
  const subDirs = getSubDirs(__dirname)
  for (const dir of subDirs) {
    const nodeModules = path.join(dir, 'node_modules')
    const testName = path.basename(dir)
    const shouldSucceed = shouldTestSucceed(dir)

    const testTitle = `${testName} example should${
      shouldSucceed ? '' : ' not'
    } succeed`
    test(testTitle, async () => {
      if (fs.existsSync(nodeModules)) {
        await del(nodeModules)
      }
      const envVars = getEnvVars(dir)
      process.env = { ...process.env, ...envVars }

      await generateInFolder({
        projectDir: dir,
        useLocalRuntime: false,
        transpile: true,
      })

      if (envVars) {
        for (const key of Object.keys(envVars)) {
          delete process.env[key]
        }
      }

      const filePath = path.join(dir, 'index.js')
      const fn = require(filePath)

      if (shouldSucceed) {
        expect(fn()).resolves.toMatchSnapshot(testTitle)
      } else {
        try {
          await fn()
        } catch (e) {
          expect(e).toMatchSnapshot(testTitle)
        }
      }
    })
  }
})

function getSubDirs(dir: string): string[] {
  const files = fs.readdirSync(dir)
  return files
    .map(file => path.join(dir, file))
    .filter(
      file =>
        fs.lstatSync(file).isDirectory() && !file.includes('__snapshots__'),
    )
}

function getEnvVars(dir: string): { [key: string]: string } | undefined {
  const envPath = path.join(dir, 'env.json')
  if (fs.existsSync(envPath)) {
    return JSON.parse(fs.readFileSync(envPath, 'utf-8'))
  }

  return undefined
}

function shouldTestSucceed(dir: string): boolean {
  const manifestPath = path.join(dir, 'manifest.json')
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Runtime Test dir ${dir} needs a manifest.json`)
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))

  return manifest.shouldSucceed
}
