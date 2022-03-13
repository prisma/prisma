import Debug from '@prisma/debug'
import { plusX } from '@prisma/engine-core'
import { getEnginesPath } from '@prisma/engines'
import { EngineType } from '@prisma/fetch-engine'
import { getNodeAPIName, getPlatform } from '@prisma/get-platform'
import fs from 'fs'
import makeDir from 'make-dir'
import path from 'path'
import tempDir from 'temp-dir'
import { promisify } from 'util'

const readFile = promisify(fs.readFile)
const writeFile = promisify(fs.writeFile)
const debug = Debug('prisma:resolveEnginePath')

async function getEngineFileName(name: EngineType): Promise<string> {
  const platform = await getPlatform()
  const extension = platform === 'windows' ? '.exe' : ''

  if (name === EngineType.libqueryEngine) {
    return getNodeAPIName(platform, 'fs')
  }
  return `${name}-${platform}${extension}`
}
export const engineEnvVarMap = {
  [EngineType.queryEngine]: 'PRISMA_QUERY_ENGINE_BINARY',
  [EngineType.libqueryEngine]: 'PRISMA_QUERY_ENGINE_LIBRARY',
  [EngineType.migrationEngine]: 'PRISMA_MIGRATION_ENGINE_BINARY',
  [EngineType.introspectionEngine]: 'PRISMA_INTROSPECTION_ENGINE_BINARY',
  [EngineType.prismaFmt]: 'PRISMA_FMT_BINARY',
}
export { EngineType }
export async function resolveEnginePath(name: EngineType, proposedPath?: string): Promise<string> {
  // special handling for pkg = /snapshot/
  if (proposedPath && !proposedPath.startsWith('/snapshot/') && fs.existsSync(proposedPath)) {
    return proposedPath
  }

  const envVar = engineEnvVarMap[name]

  if (process.env[envVar]) {
    if (!fs.existsSync(process.env[envVar]!)) {
      throw new Error(`Env var ${envVar} is provided, but provided path ${process.env[envVar]} can't be resolved.`)
    }
    return process.env[envVar]!
  }

  const dir = eval('__dirname')

  const engineFileName = await getEngineFileName(name)

  let prismaPath = path.join(getEnginesPath(), engineFileName)
  if (fs.existsSync(prismaPath)) {
    return maybeCopyToTmp(prismaPath)
  }
  // for pkg
  prismaPath = path.join(__dirname, '..', engineFileName)
  if (fs.existsSync(prismaPath)) {
    return maybeCopyToTmp(prismaPath)
  }

  prismaPath = path.join(__dirname, '../..', engineFileName)
  if (fs.existsSync(prismaPath)) {
    return maybeCopyToTmp(prismaPath)
  }

  // needed to come from @prisma/client/generator-build to @prisma/client/runtime
  prismaPath = path.join(__dirname, '../runtime', engineFileName)
  if (fs.existsSync(prismaPath)) {
    return maybeCopyToTmp(prismaPath)
  }

  throw new Error(
    `Could not find ${name} engine. Searched in ${path.join(dir, '..', engineFileName)} and ${path.join(
      dir,
      '../..',
      engineFileName,
    )}`,
  )
}

export async function maybeCopyToTmp(file: string): Promise<string> {
  // in this case, we are in a "pkg" context with a virtual fs
  // to make this work, we need to copy the engine to /tmp and execute it from there

  const dir = eval('__dirname')
  if (dir.startsWith('/snapshot/')) {
    const targetDir = path.join(tempDir, 'prisma-engines')
    await makeDir(targetDir)
    const target = path.join(targetDir, path.basename(file))
    const data = await readFile(file)
    await writeFile(target, data)
    // We have to read and write until https://github.com/zeit/pkg/issues/639
    // is resolved
    // await copyFile(file, target)
    plusX(target)
    return target
  }

  return file
}
