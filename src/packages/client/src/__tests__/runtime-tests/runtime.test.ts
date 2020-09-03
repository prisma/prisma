import fs from 'fs'
import path from 'path'
import { generateInFolder } from '../../utils/generateInFolder'
import { promisify } from 'util'
import rimraf from 'rimraf'
import stripAnsi from 'strip-ansi'
import execa from 'execa'
import { getPackedPackage } from '@prisma/sdk'
const del = promisify(rimraf)

jest.setTimeout(30000)

let subDirs = getSubDirs(__dirname)
process.setMaxListeners(subDirs.length * 2)
const folderFilter = process.argv.length === 4 ? process.argv[3] : null

if (
  folderFilter &&
  !['--', '-u'].includes(folderFilter) &&
  /[\w-]+/.test(folderFilter)
) {
  const dirsLeft = subDirs.filter((dir) => dir.includes(folderFilter))
  if (dirsLeft.length > 0) {
    subDirs = [dirsLeft[0]] // only take the first matchh
    console.log(
      `As ${folderFilter} is provided, only ${subDirs.join(
        ', ',
      )} is being tested`,
    )
  }
}

subDirs = subDirs.map((d) => path.relative(__dirname, d))

let packageSource: string
beforeAll(async () => {
  packageSource = (await getPackedPackage('@prisma/client')) as string
})

// afterAll(async () => {
//   const children = await pidtree(process.pid)
//   console.log(children)
//   for (const child of children) {
//     try {
//       process.kill(child, 'SIGKILL')
//       console.log(`Killing ${child} succeeded`)
//     } catch (e) {
//       console.error(e)
//     }
//   }
//   // setTimeout(() => {
//   // }, 200)
// })

describe('runtime', () => {
  test.each(subDirs)('%s', async (dir) => {
    dir = path.join(__dirname, dir)
    const nodeModules = path.join(dir, 'node_modules')
    const testName = path.basename(dir)
    const shouldSucceed = shouldTestSucceed(dir)

    const testTitle = `${testName} example should${
      shouldSucceed ? '' : ' not'
    } succeed`
    if (fs.existsSync(nodeModules)) {
      await del(nodeModules)
    }
    const envVars = getEnvVars(dir)
    process.env = { ...process.env, ...envVars }

    await generateInFolder({
      projectDir: dir,
      useLocalRuntime: false,
      transpile: true,
      packageSource,
    })

    if (envVars) {
      for (const key of Object.keys(envVars)) {
        delete process.env[key]
      }
    }

    const filePath = path.join(dir, 'index.js')
    const { data, error, stdout, stderr } = await run(filePath)

    if (shouldSucceed) {
      if (error) {
        throw new Error(`${testTitle} should succeed, but error:` + error)
      }
      expect(data).toMatchSnapshot(testTitle)
    } else {
      if (!error) {
        throw new Error(
          `${testTitle} should not succeed, but the error is missing`,
        )
      }
      // https://regex101.com/r/GPVRYg/1/
      // remove the paths, so the tests can succeed on any machine
      expect(
        stripAnsi(error!)
          .replace(/(\/[\/\S+]+)/gm, '')
          .replace(/current\s+platform\s+\S+"/gim, 'current platform')
          .replace(/the\s+platform\s+\S+/gim, 'the platform X'),
      ).toMatchSnapshot(testTitle)
    }
  })
})
// for (const dir of subDirs) {
// }

function getSubDirs(dir: string): string[] {
  const files = fs.readdirSync(dir)
  return files
    .map((file) => path.join(dir, file))
    .filter(
      (file) =>
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

type RunResult = {
  stderr: string
  stdout: string
  data?: any
  error?: string
}

async function run(filePath: string): Promise<RunResult> {
  const runPath = path.join(__dirname, 'runner.js')
  const child = execa.node(runPath)
  let data
  let error
  child.on('message', (message) => {
    const result = JSON.parse(message)
    if (result.data) {
      data = result.data
    }
    if (result.error) {
      error = result.error
    }
  })
  process.nextTick(() => {
    child.send(JSON.stringify({ filePath }))
  })
  const result = await child
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    data,
    error,
  }
}
