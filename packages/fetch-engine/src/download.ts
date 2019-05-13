// Inspired by https://github.com/zeit/now-cli/blob/canary/download/src/index.js
// Native
import fs from 'fs'
import zlib from 'zlib'

// Packages
import onDeath from 'death'
import fetch from 'node-fetch'
import retry from 'p-retry'
import getos from 'getos'

// Utils
import { disableProgress, enableProgress, info, showProgress, warn } from './log'
import plusxSync from './chmod'

// const tmpDir = `/tmp/prisma/`
// const tmpTarget = `/tmp/prisma/prisma-${packageJSON.version}`
// const partial = prisma + '.partial'

/**
 * TODO: Check if binary already exists and if checksum is the same!
 */
export async function download(prismaBinPath: string, schemaInferrerBinPath: string, version: string) {
  try {
    fs.writeFileSync(
      prismaBinPath,
      '#!/usr/bin/env node\n' + 'console.log("Please wait until the \'prisma\' installation completes!")\n',
    )
  } catch (err) {
    if (err.code === 'EACCES') {
      warn('Please try installing Prisma CLI again with the `--unsafe-perm` option.')
      info('Example: `npm i -g --unsafe-perm prisma`')

      process.exit()
    }

    throw err
  }

  onDeath(() => {
    fs.writeFileSync(
      prismaBinPath,
      '#!/usr/bin/env node\n' +
        'console.log("The \'prisma\' installation did not complete successfully.")\n' +
        'console.log("Please run \'npm i -g prisma\' to reinstall!")\n',
    )
    process.exit()
  })

  info('For the source code, check out: https://github.com/prisma/prisma')

  // Print an empty line
  console.log('')
  const platform = await getPlatform()

  // if (fs.existsSync(tmpTarget)) {
  //   await copy(tmpTarget, prisma)
  // } else {

  enableProgress('Downloading Prisma Binary ' + version)
  showProgress(0)

  await downloadFile(getPrismaDownloadUrl(platform), prismaBinPath)
  await downloadZip(getSchemaInferrerDownloadUrl(platform), schemaInferrerBinPath, 50)
  showProgress(100)
  disableProgress()

  plusxSync(prismaBinPath)
  plusxSync(schemaInferrerBinPath)

  /**
   * Cache the result only on Mac for better dev experience
   */
  // if (platform === 'macos') {
  //   if (!fs.existsSync(tmpDir)) {
  //     fs.mkdirSync(tmpDir)
  //   }
  //   try {
  //     await copy(prisma, tmpTarget)
  //   } catch (e) {
  //     // let this fail silently - the CI system may have reached the file size limit
  //   }
  // }
  // }
}

async function downloadZip(url: string, target: string, progressOffset = 0) {
  const partial = target + '.partial'
  await retry(
    async () => {
      try {
        const resp = await fetch(url, { compress: false })

        if (resp.status !== 200) {
          throw new Error(resp.statusText + ' ' + url)
        }

        const size = resp.headers.get('content-length')
        const ws = fs.createWriteStream(partial)

        await new Promise((resolve, reject) => {
          let bytesRead = 0

          resp.body.on('error', reject).on('data', chunk => {
            bytesRead += chunk.length

            if (size) {
              showProgress((50 * bytesRead) / size + progressOffset)
            }
          })

          const gunzip = zlib.createGunzip()

          gunzip.on('error', reject)

          resp.body.pipe(gunzip).pipe(ws)

          ws.on('error', reject).on('close', () => {
            resolve()
          })
        })
      } finally {
        //
      }
    },
    {
      retries: 1,
      onFailedAttempt: err => console.error(err),
    },
  )
  fs.renameSync(partial, target)
}

async function downloadFile(url: string, target: string, progressOffset = 0) {
  await retry(
    async () => {
      try {
        const resp = await fetch(url, { compress: false })

        if (resp.status !== 200) {
          throw new Error(resp.statusText + ' ' + url)
        }

        const size = resp.headers.get('content-length')
        const ws = fs.createWriteStream(target)

        await new Promise((resolve, reject) => {
          let bytesRead = 0

          resp.body.on('error', reject).on('data', chunk => {
            bytesRead += chunk.length

            if (size) {
              showProgress((50 * bytesRead) / size + progressOffset)
            }
          })

          resp.body.pipe(ws)

          ws.on('error', reject).on('close', () => {
            resolve()
          })
        })
      } finally {
        //
      }
    },
    {
      retries: 1,
      onFailedAttempt: err => console.error(err),
    },
  )
}

async function getPlatform() {
  const { os, dist } = (await new Promise(r => {
    getos((e, os) => {
      r(os)
    })
  })) as any

  if (os === 'darwin') {
    return 'darwin'
  }

  if (os === 'linux' && dist === 'Raspbian') {
    return 'linux-musl'
  }

  return 'linux-glibc'
}

function getSchemaInferrerDownloadUrl(platform: string) {
  if (platform.startsWith('linux-')) {
    platform = 'linux'
  }
  return `https://s3-eu-west-1.amazonaws.com/curl-linux/prisma-native/${platform}/schema-inferrer-bin.gz`
}

function getPrismaDownloadUrl(platform: string) {
  return `https://s3-eu-west-1.amazonaws.com/prisma-native/alpha/latest/${platform}/prisma`
}
