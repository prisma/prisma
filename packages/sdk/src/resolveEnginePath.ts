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
  // if file exists at proposedPath (and does not start with `/snapshot/` (= pkg), use that one
  if (proposedPath && !proposedPath.startsWith('/snapshot/') && fs.existsSync(proposedPath)) {
    return proposedPath
  }

  // If engine path was provided via env var, check and use that one
  const envVar = engineEnvVarMap[name]
  if (process.env[envVar]) {
    if (!fs.existsSync(process.env[envVar]!)) {
      throw new Error(`Env var ${envVar} is provided, but provided path ${process.env[envVar]} can't be resolved.`)
    }
    return process.env[envVar]!
  }

  // If still here, try different paths
  const engineFileName = await getEngineFileName(name)

  const prismaPath = path.join(getEnginesPath(), engineFileName)
  if (fs.existsSync(prismaPath)) {
    return maybeCopyToTmp(prismaPath)
  }
  
  // for pkg (related: https://github.com/vercel/pkg#snapshot-filesystem)
  const prismaPath2 = path.join(__dirname, '..', engineFileName)
  if (fs.existsSync(prismaPath2)) {
    return maybeCopyToTmp(prismaPath2)
  }

  // TODO for ??
  const prismaPath3 = path.join(__dirname, '../..', engineFileName)
  if (fs.existsSync(prismaPath3)) {
    return maybeCopyToTmp(prismaPath3)
  }

  // TODO for ?? / needed to come from @prisma/client/generator-build to @prisma/client/runtime
  const prismaPath4 = path.join(__dirname, '../runtime', engineFileName)
  if (fs.existsSync(prismaPath4)) {
    return maybeCopyToTmp(prismaPath4)
  }

  // Still here? Could not find the engine, so error out.
  throw new Error(
    `Could not find ${name} binary. Searched in:
- ${prismaPath}
- ${prismaPath2}
- ${prismaPath3}
- ${prismaPath4}`,
  )
}

export async function maybeCopyToTmp(file: string): Promise<string> {
  // in this case, we are in a "pkg" context with a virtual fs
  // to make this work, we need to copy the engine to /tmp and execute it from there

  const dir = eval('__dirname')
  
  if (dir.startsWith('/snapshot/')) {
    // in this case, we are in a "pkg" context with a virtual fs
    // to make this work, we need to copy the binary to /tmp and execute it from there
    // TODO Why is this needed? What happens if you do not do it?
    // TODO Probably to be able to make the file executable?
    // TODO Go and Python Client (which use pkg) actually provide the binaries _outside_ of the CLI via env vars - so never and up here
    const targetDir = path.join(tempDir, 'prisma-engines')
    await makeDir(targetDir)
    const target = path.join(targetDir, path.basename(file))
    
    // We have to read and write until https://github.com/zeit/pkg/issues/639 is resolved
    const data = await readFile(file)
    await writeFile(target, data)
    // TODO Undo when https://github.com/vercel/pkg/pull/1484 is released
    // await copyFile(file, target)
    
    plusX(target)
    return target
  }

  return file
}
