const childProcess = require('child_process')
const { promisify } = require('util')
const exec = promisify(childProcess.exec)
const c = require('./colors')

async function main() {
  const installedGlobally = await isInstalledGlobally()
  if (installedGlobally) {
    const { stdout, stderr } = await exec('prisma2 generate')
    if (stdout) {
      console.log(stdout)
    }
    if (stderr) {
      console.error(stderr)
    }
  }

  const localPath = getLocalPackagePath()
  if (!localPath) {
    throw new Error(
      `In order to use "@prisma/photon", please install prisma2. You can install it with "npm add -D prisma2".`,
    )
  }

  await exec(`node ${localPath} generate`)
}

function getLocalPackagePath() {
  try {
    return require.resolve('prisma2')
  } catch (e) {
    return null
  }
}

async function isInstalledGlobally() {
  try {
    await exec('prisma2 -v')
    return true
  } catch (e) {
    return false
  }
}

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
