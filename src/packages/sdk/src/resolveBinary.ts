import { plusX } from '@prisma/engine-core/dist/util'
import { enginesVersion, getEnginesPath } from '@prisma/engines'
import { download, EngineTypes } from '@prisma/fetch-engine'
import { getNapiName, getPlatform } from '@prisma/get-platform'
import fs from 'fs'
import makeDir from 'make-dir'
import path from 'path'
import tempDir from 'temp-dir'
import { promisify } from 'util'
import Debug from '@prisma/debug'

const readFile = promisify(fs.readFile)
const writeFile = promisify(fs.writeFile)
const debug = Debug('prisma:resolveBinary')

export const engineEnvVarMap = {
  [EngineTypes.queryEngine]: 'PRISMA_QUERY_ENGINE_BINARY',
  [EngineTypes.libqueryEngineNapi]: 'PRISMA_QUERY_ENGINE_LIBRARY',
  [EngineTypes.migrationEngine]: 'PRISMA_MIGRATION_ENGINE_BINARY',
  [EngineTypes.introspectionEngine]: 'PRISMA_INTROSPECTION_ENGINE_BINARY',
  [EngineTypes.prismaFmt]: 'PRISMA_FMT_BINARY',
}
export { EngineTypes }
export async function resolveBinary(
  name: EngineTypes,
  proposedPath?: string,
): Promise<string> {
  if (
    proposedPath &&
    !proposedPath.startsWith('/snapshot/') &&
    fs.existsSync(proposedPath)
  ) {
    return proposedPath
  }
  // tslint:disable-next-line

  const envVar = engineEnvVarMap[name]

  if (process.env[envVar]) {
    if (!fs.existsSync(process.env[envVar]!)) {
      throw new Error(
        `Env var ${envVar} is provided, but provided path ${process.env[envVar]} can't be resolved.`,
      )
    }
    return process.env[envVar]!
  }

  const dir = eval('__dirname')

  const platform = await getPlatform()
  const extension = platform === 'windows' ? '.exe' : ''
  let binaryName = `${name}-${platform}${extension}`
  if (name === EngineTypes.libqueryEngineNapi) {
    binaryName = getNapiName(platform, 'fs')
    if (!fs.existsSync(path.join(getEnginesPath(), binaryName))) {
      debug('Downloading N-API Library')
      await download({
        binaries: {
          'libquery-engine-napi': getEnginesPath(),
        },
        version: enginesVersion,
      })
    }
  }

  let prismaPath = path.join(getEnginesPath(), binaryName)
  if (fs.existsSync(prismaPath)) {
    return maybeCopyToTmp(prismaPath)
  }
  // for pkg
  prismaPath = path.join(__dirname, '..', binaryName)
  if (fs.existsSync(prismaPath)) {
    return maybeCopyToTmp(prismaPath)
  }

  prismaPath = path.join(__dirname, '../..', binaryName)
  if (fs.existsSync(prismaPath)) {
    return maybeCopyToTmp(prismaPath)
  }

  // needed to come from @prisma/client/generator-build to @prisma/client/runtime
  prismaPath = path.join(__dirname, '../runtime', binaryName)
  if (fs.existsSync(prismaPath)) {
    return maybeCopyToTmp(prismaPath)
  }

  throw new Error(
    `Could not find ${name} binary. Searched in ${path.join(
      dir,
      '..',
      binaryName,
    )} and ${path.join(dir, '../..', binaryName)}`,
  )
}

export async function maybeCopyToTmp(file: string): Promise<string> {
  // in this case, we are in a "pkg" context with a virtual fs
  // to make this work, we need to copy the binary to /tmp and execute it from there

  const dir = eval('__dirname')
  if (dir.startsWith('/snapshot/')) {
    const targetDir = path.join(tempDir, 'prisma-binaries')
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
