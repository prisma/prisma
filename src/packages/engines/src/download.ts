import Debug from '@prisma/debug'
import { enginesVersion } from '@prisma/engines-version'
import {
  BinaryDownloadConfiguration,
  download,
  EngineTypes,
} from '@prisma/fetch-engine'
import fs from 'fs'
import path from 'path'
const debug = Debug('prisma:download')

const binaryDir = path.join(__dirname, '../')

const lockFile = path.join(binaryDir, 'download-lock')

let createdLockFile = false
async function main() {
  if (
    fs.existsSync(lockFile) &&
    parseInt(fs.readFileSync(lockFile, 'utf-8'), 10) > Date.now() - 20000
  ) {
    debug(
      `Lock file already exists, so we're skipping the download of the prisma binaries`,
    )
  } else {
    createLockFile()
    let binaryTargets = undefined
    if (process.env.PRISMA_CLI_BINARY_TARGETS) {
      binaryTargets = process.env.PRISMA_CLI_BINARY_TARGETS.split(',')
    }
    debug(`using NAPI: ${process.env.PRISMA_FORCE_NAPI === 'true'}`)
    const binaries: BinaryDownloadConfiguration = {
      [EngineTypes.queryEngine]: binaryDir,
      [EngineTypes.migrationEngine]: binaryDir,
      [EngineTypes.introspectionEngine]: binaryDir,
      [EngineTypes.prismaFmt]: binaryDir,
    }
    // TODO tmp workaround until https://github.com/prisma/prisma/pull/7152 is merged
    if(process.env.PRISMA_FORCE_NAPI === 'true'){
      binaries[EngineTypes.libqueryEngineNapi] = binaryDir
    }
    await download({
      binaries,
      showProgress: true,
      version: enginesVersion,
      failSilent: true,
      binaryTargets,
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

// if we are in a Now context, ensure that `prisma generate` is in the postinstall hook
process.on('beforeExit', () => {
  cleanupLockFile()
})

process.once('SIGINT', () => {
  cleanupLockFile()
  process.exit()
})
