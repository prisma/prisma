import fs from 'fs'
import path from 'path'
import { generateInFolder } from '../../utils/generateInFolder'

jest.setTimeout(30000)

describe('runtime works', () => {
  const subDirs = getSubDirs(__dirname)
  for (const dir of subDirs) {
    const testName = path.basename(dir)

    test(`can run ${testName} example`, async () => {
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

      if (envVars) {
        try {
          await fn()
        } catch (e) {
          expect(e).toMatchSnapshot()
        }
      } else {
        expect(fn()).resolves.toMatchSnapshot()
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
