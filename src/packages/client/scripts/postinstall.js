const childProcess = require('child_process')
const { promisify } = require('util')
const fs = require('fs')
const path = require('path')
const c = require('./colors')

const exec = promisify(childProcess.exec)
const copyFile = promisify(fs.copyFile)
const mkdir = promisify(fs.mkdir)
const stat = promisify(fs.stat)

async function main() {
  if (process.env.INIT_CWD) {
    process.chdir(process.env.INIT_CWD) // necessary, because npm chooses __dirname as process.cwd()
    // in the postinstall hook
  }
  await ensureEmptyDotPrisma()

  const localPath = getLocalPackagePath()
  // Only execute if !localpath
  const installedGlobally = localPath ? undefined : await isInstalledGlobally()

  process.env.PRISMA_GENERATE_IN_POSTINSTALL = 'true'
  try {
    if (localPath) {
      await run('node', [localPath, 'generate', '--postinstall'])
      return
    }

    if (installedGlobally) {
      await run('prisma', ['generate', '--postinstall'])
      return
    }
  } catch (e) {
    // if exit code = 1 do not print
    if (e && e !== 1) {
      console.error(e)
    }
  }

  if (!localPath && !installedGlobally) {
    console.error(
      `${c.yellow(
        'warning',
      )} In order to use "@prisma/client", please install @prisma/cli. You can install it with "npm add -D @prisma/cli".`,
    )
  }
}

function getLocalPackagePath() {
  let packagePath
  try {
    packagePath = require.resolve('@prisma/cli/package.json')
  } catch (e) {
    return null
  }

  if (packagePath) {
    return require.resolve('@prisma/cli')
  }

  return null
}

async function isInstalledGlobally() {
  try {
    const result = await exec('prisma -v')
    if (result.stdout.includes('@prisma/cli')) {
      return true
    } else {
      console.error(`${c.yellow('warning')} You still have the ${c.bold(
        'prisma',
      )} cli (Prisma 1) installed globally.
Please uninstall it with either ${c.green('npm remove -g prisma')} or ${c.green(
        'yarn global remove prisma',
      )}.`)
    }
  } catch (e) {
    return false
  }
}

if (!process.env.SKIP_GENERATE) {
  main().catch((e) => {
    if (e.stderr) {
      if (e.stderr.includes(`Can't find schema.prisma`)) {
        console.error(
          `${c.yellow('warning')} @prisma/client needs a ${c.bold(
            'schema.prisma',
          )} to function, but couldn't find it.
        Please either create one manually or use ${c.bold('prisma init')}.
        Once you created it, run ${c.bold('prisma generate')}.
        To keep Prisma related things separate, we recommend creating it in a subfolder called ${c.underline(
          './prisma',
        )} like so: ${c.underline('./prisma/schema.prisma')}\n`,
        )
      } else {
        console.error(e.stderr)
      }
    } else {
      console.error(e)
    }
    process.exit(0)
  })
}

function run(cmd, params) {
  const child = childProcess.spawn(cmd, params, {
    stdio: ['pipe', 'inherit', 'inherit'],
  })

  return new Promise((resolve, reject) => {
    child.on('close', () => {
      resolve()
    })
    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(code)
      }
    })
    child.on('error', () => {
      reject()
    })
  })
}

async function ensureEmptyDotPrisma() {
  try {
    const dotPrismaClientDir = path.join(__dirname, '../../../.prisma/client')
    await makeDir(dotPrismaClientDir)
    const defaultIndexJsPath = path.join(dotPrismaClientDir, 'index.js')
    const defaultIndexDTSPath = path.join(dotPrismaClientDir, 'index.d.ts')

    if (!fs.existsSync(defaultIndexJsPath)) {
      await copyFile(
        path.join(__dirname, 'default-index.js'),
        defaultIndexJsPath,
      )
    }

    if (!fs.existsSync(defaultIndexDTSPath)) {
      await copyFile(
        path.join(__dirname, 'default-index.d.ts'),
        defaultIndexDTSPath,
      )
    }
  } catch (e) {
    console.error(e)
  }
}

async function makeDir(input) {
  const make = async (pth) => {
    try {
      await mkdir(pth)

      return pth
    } catch (error) {
      if (error.code === 'EPERM') {
        throw error
      }

      if (error.code === 'ENOENT') {
        if (path.dirname(pth) === pth) {
          throw permissionError(pth)
        }

        if (error.message.includes('null bytes')) {
          throw error
        }

        await make(path.dirname(pth))

        return make(pth)
      }

      try {
        const stats = await stat(pth)
        if (!stats.isDirectory()) {
          throw new Error('The path is not a directory')
        }
      } catch (_) {
        throw error
      }

      return pth
    }
  }

  return make(path.resolve(input))
}
