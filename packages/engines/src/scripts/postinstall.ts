import fs from 'node:fs'
import path from 'node:path'
import Debug from '@prisma/debug'
import { enginesVersion } from '@prisma/engines-version'
import { type BinaryDownloadConfiguration, BinaryType, download } from '@prisma/fetch-engine'
import type { BinaryTarget } from '@prisma/get-platform'

import { getCliQueryEngineBinaryType } from '..'

const debug = Debug('prisma:download')

const baseDir = path.join(__dirname, '../../')

const lockFile = path.join(baseDir, 'download-lock')

let createdLockFile = false
async function main() {
  if (fs.existsSync(lockFile) && Number.parseInt(fs.readFileSync(lockFile, 'utf-8'), 10) > Date.now() - 20_000) {
    debug(`Lock file already exists, so we're skipping the download of the prisma binaries`)
  } else {
    createLockFile()
    let binaryTargets: string[] | undefined
    if (process.env.PRISMA_CLI_BINARY_TARGETS) {
      binaryTargets = process.env.PRISMA_CLI_BINARY_TARGETS.split(',')
    }
    const cliQueryEngineBinaryType = getCliQueryEngineBinaryType()

    const binaries: BinaryDownloadConfiguration = {
      [cliQueryEngineBinaryType]: baseDir,
      [BinaryType.SchemaEngineBinary]: baseDir,
    }

    await download({
      binaries,
      version: enginesVersion,
      showProgress: true,
      failSilent: true,
      binaryTargets: binaryTargets as BinaryTarget[],
    }).catch((e) => debug(e))

    cleanupLockFile()
  }
}

function createLockFile() {
  createdLockFile = true
  fs.writeFileSync(lockFile, Date.now().toString())
}

function cleanupLockFile() {
  if (createdLockFile) {
    try {
      if (fs.existsSync(lockFile)) {
        fs.unlinkSync(lockFile)
      }
    } catch (e) {
      debug(e)
    }
  }
}

main().catch((e) => debug(e))

process.on('beforeExit', () => {
  cleanupLockFile()
})

process.once('SIGINT', () => {
  cleanupLockFile()
  process.exit()
})
