import fs from 'fs-extra'
import path from 'path'
import { download } from './download'

export async function ensureBinaries() {
  const runtimeDir = await getRuntimeDir()
  if (await fs.pathExists(runtimeDir)) {
    const prisma = path.join(runtimeDir, 'prisma')
    const schemaInferrer = path.join(runtimeDir, 'schema-inferrer-bin')
    if (!(await fs.pathExists(prisma)) && !(await fs.pathExists(schemaInferrer))) {
      await download(prisma, schemaInferrer, '0.0.1')
    }
  } else {
    throw new Error(`Cannot download binaries as path ${runtimeDir} does not exist`)
  }
}

async function getRuntimeDir() {
  let buildDir = path.join(__dirname, '../runtime')
  if (await fs.pathExists(buildDir)) {
    return buildDir
  }
  buildDir = path.join(__dirname, '../../runtime')
  if (await fs.pathExists(buildDir)) {
    return buildDir
  }
}
