const childProcess = require('child_process')
const { promisify } = require('util')
const exec = promisify(childProcess.exec)
const c = require('./colors')

async function main() {
  if (process.env.INIT_CWD) {
    process.chdir(process.env.INIT_CWD) // necessary, because npm chooses __dirname as process.cwd()
    // in the postinstall hook
  }

  const localPath = getLocalPackagePath()
  // Only execute if !localpath
  const installedGlobally = localPath ? undefined : await isInstalledGlobally()

  try {
    if (localPath) {
      await run('node', [localPath, 'generate'])
      return
    }

    if (installedGlobally) {
      await run('prisma', ['generate'])
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
