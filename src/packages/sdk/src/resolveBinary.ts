import fs from 'fs'
import path from 'path'
import tempDir from 'temp-dir'
import makeDir from 'make-dir'
import { promisify } from 'util'
import { getPlatform } from '@prisma/get-platform'
import { plusX } from '@prisma/engine-core/dist/util'
import Debug from 'debug'
const debug = Debug('resolveBinary')

const readFile = promisify(fs.readFile)
const writeFile = promisify(fs.writeFile)
// const copyFile = promisify(fs.copyFile)

export type EngineType =
  | 'query-engine'
  | 'migration-engine'
  | 'introspection-engine'
  | 'prisma-fmt'

const engineEnvVarMap = {
  'query-engine': 'PRISMA_QUERY_ENGINE_BINARY',
  'migration-engine': 'PRISMA_MIGRATION_ENGINE_BINARY',
  'introspection-engine': 'PRISMA_INTROSPECTION_ENGINE_BINARY',
  'prisma-fmt': 'PRISMA_FMT_BINARY',
}

export async function resolveBinary(name: EngineType): Promise<string> {
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
  const binaryName = `${name}-${platform}${extension}`
  let prismaPath = path.join(dir, '..', binaryName)
  if (fs.existsSync(prismaPath)) {
    return maybeCopyToTmp(prismaPath)
  }
  // for pkg
  prismaPath = path.join(dir, '../..', binaryName)
  if (fs.existsSync(prismaPath)) {
    return maybeCopyToTmp(prismaPath)
  }

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

async function maybeCopyToTmp(file: string): Promise<string> {
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
