const childProcess = require('child_process')
const { promisify } = require('util')

const exec = promisify(childProcess.exec)

export async function generate() {
  const localPath = getLocalPackagePath()
  console.log(localPath)
  try {
    if (localPath) {
      await run('node', [localPath, 'generate'])
    }
  } catch (e) {
    console.error(e)
  }
  return
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
