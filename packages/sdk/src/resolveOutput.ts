import fs from 'fs'
import path from 'path'
import { promisify } from 'util'

const exists = promisify(fs.exists)

async function resolveNodeModulesBase(cwd: string): Promise<string> {
  if (await exists(path.resolve(process.cwd(), 'prisma/schema.prisma'))) {
    return process.cwd()
  }
  if (path.relative(process.cwd(), cwd) === 'prisma' && (await exists(path.resolve(process.cwd(), 'package.json')))) {
    return process.cwd()
  }
  if (await exists(path.resolve(cwd, 'node_modules'))) {
    return cwd
  }
  if (await exists(path.resolve(cwd, '../node_modules'))) {
    return path.join(cwd, '../')
  }
  if (await exists(path.resolve(cwd, 'package.json'))) {
    return cwd
  }
  if (await exists(path.resolve(cwd, '../package.json'))) {
    return path.join(cwd, '../')
  }
  return cwd
}

export type ResolveOutputOptions = {
  defaultOutput: string
  baseDir: string // normally `schemaDir`, the dir containing the schema.prisma file
}

export async function resolveOutput(options: ResolveOutputOptions): Promise<string> {
  const defaultOutput = stripRelativePath(options.defaultOutput)
  if (defaultOutput.startsWith('node_modules')) {
    const nodeModulesBase = await resolveNodeModulesBase(options.baseDir)
    return path.resolve(nodeModulesBase, defaultOutput)
  }

  return path.resolve(options.baseDir, defaultOutput)
}

function stripRelativePath(pathString: string): string {
  if (pathString.startsWith('./')) {
    return pathString.slice(2)
  }
  return pathString
}
