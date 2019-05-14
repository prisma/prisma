import fs from 'fs'
import path from 'path'
import { download } from './download'
import { promisify } from 'util'
import makeDir from 'make-dir'

const exists = promisify(fs.exists)

export async function ensureBinaries(resultPath?: string) {
  const runtimeDir = resultPath || (await getRuntimeDir())
  await makeDir(runtimeDir)
  const prisma = path.join(runtimeDir, 'prisma')
  const schemaInferrer = path.join(runtimeDir, 'schema-inferrer-bin')
  await download(prisma, schemaInferrer, '0.0.1')
}

async function getRuntimeDir() {
  let runtimeDir = path.join(__dirname, '../runtime')
  if (await exists(runtimeDir)) {
    return runtimeDir
  }
  runtimeDir = path.join(__dirname, '../../runtime')
  if (await exists(runtimeDir)) {
    return runtimeDir
  }
  // node_modules/fetch-engine/run.js
  runtimeDir = path.join(__dirname, '../../../runtime')
  if (await exists(runtimeDir)) {
    return runtimeDir
  }
  throw new Error(`Cannot download binaries as path ${runtimeDir} does not exist`)
}
