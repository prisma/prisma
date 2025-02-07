import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { Debug } from '@prisma/driver-adapter-utils'
import { register as esbuildRegister } from 'esbuild-register/dist/node'
import { PrismaConfig } from './defineConfig'

const debug = Debug('prisma:config:loadConfigFromFile')

type LoadConfigFromFileInput = {
  configFile?: string
  configRoot?: string
}

export async function loadConfigFromFile(
  {
    configFile,
    configRoot = process.cwd(),
  }: LoadConfigFromFileInput
): Promise<{
  resolvedPath: string | null,
  config?: PrismaConfig,
}> {
  const start = performance.now()
  const getTime = () => `${(performance.now() - start).toFixed(2)}ms`

  let resolvedPath: string | undefined

  if (configFile) {
      // explicit config path is always resolved from cwd
      resolvedPath = path.resolve(configRoot, configFile)
  } else {
    // TODO: add support for `.config/prisma.ts`?
    const defaultConfigFiles = ['prisma.config.ts']
    for (const configFile of defaultConfigFiles) {
      const configFilePath = path.resolve(configRoot, configFile)
      if (!fs.existsSync(configFilePath)) {
        continue
      }

      resolvedPath = configFilePath
      break
    }
  }

  if (!resolvedPath) {
    debug(`No config file found in the given path %s`, configRoot)

    return { resolvedPath: null }
  }

  // TODO: we might want to parse the `configExport` value to determine if it matches our expectations,
  // rather than just blindly relying on TypeScript checks.
  // I.e., distinguish between `config` and `validatedConfig`.
  const configExport = requireTypeScriptFile(resolvedPath)
  debug(`Config file loaded in %s`, getTime())

  const config = configExport['default'] as unknown as PrismaConfig

  return {
    config,
    resolvedPath,
  }
}

// Note: `esbuild-register` combines well with `esbuild`, which we already use.
// However, we might consider adopting `jiti` in the future, either directly or
// via `c12`.
function safeTypeScriptRegisterLoader() {
  const defaultResult = { unregister: () => {} }
  let res: typeof defaultResult

  try {
    res = esbuildRegister({
      format: 'cjs',
      loader: 'ts',
    })
  } catch (error) {
    debug('esbuild-register registration failed')
    console.error(error)
    // fallback
    res = defaultResult
  }

  return res
}

function requireTypeScriptFile(resolvedPath: string) {
  const { unregister } = safeTypeScriptRegisterLoader()
  const configExport = require(resolvedPath)
  unregister()

  return configExport
}
