const childProcess = require('child_process')
const { promisify } = require('util')
const exec = promisify(childProcess.exec)
const c = require('./colors')

async function main() {
  const localPath = getLocalPackagePath()
  if (localPath) {
    await exec(`node ${localPath} generate`)
    return
  }

  const installedGlobally = await isInstalledGlobally()
  if (installedGlobally) {
    const { stdout, stderr } = await exec('prisma2 generate')
    if (stdout) {
      console.log(stdout)
    }
    if (stderr) {
      console.error(stderr)
    }
    return
  }
  throw new Error(
    `In order to use "@prisma/photon", please install prisma2. You can install it with "npm add -D prisma2".`,
  )
}

function getLocalPackagePath() {
  let packagePath
  try {
    packagePath = require.resolve('prisma2/package.json')
  } catch (e) {
    return null
  }

  if (packagePath) {
    const pkg = require('prisma2/package.json')
    const photonVersion = require('../package.json').version
    if (pkg.version !== photonVersion) {
      console.error(
        `${c.red('Error')} ${c.bold(
          '@prisma/photon',
        )} and the locally installed ${c.bold(
          'prisma2',
        )} must have the same version:
  ${c.bold(`@prisma/photon@${photonVersion}`)} doesn't match ${c.bold(
          `prisma2@${pkg.version}`,
        )}`,
      )
      process.exit(0)
    }
    return require.resolve('prisma2')
  }

  return null
}

async function isInstalledGlobally() {
  try {
    await exec('prisma2 -v', { shell: true })
    return true
  } catch (e) {
    return false
  }
}

if (!process.env.SKIP_GENERATE) {
  main().catch(e => {
    if (e.stderr) {
      if (e.stderr.includes(`Can't find schema.prisma`)) {
        console.error(
          `${c.yellow('warning')} @prisma/photon needs a ${c.bold(
            'schema.prisma',
          )} to function, but couldn't find it.
        Please either create one manually or use ${c.bold('prisma2 init')}.
        Once you created it, run ${c.bold('prisma2 generate')}.
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
