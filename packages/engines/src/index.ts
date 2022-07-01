import Debug from '@prisma/debug'
import { enginesVersion } from '@prisma/engines-version'
import { EngineTypeEnum, download } from '@prisma/fetch-engine'
import type { Platform } from '@prisma/get-platform'
import path from 'path'

const debug = Debug('prisma:engines')
export function getEnginesPath() {
  return path.join(__dirname, '../')
}
export const DEFAULT_CLI_QUERY_ENGINE_BINARY_TYPE = EngineTypeEnum.libqueryEngine // TODO: name not clear
/**
 * Checks if the env override `PRISMA_CLI_QUERY_ENGINE_TYPE` is set to `library` or `binary`
 * Otherwise returns the default
 */
export function getCliQueryEngineBinaryType(): EngineTypeEnum.libqueryEngine | EngineTypeEnum.queryEngine {
  const envCliQueryEngineType = process.env.PRISMA_CLI_QUERY_ENGINE_TYPE
  if (envCliQueryEngineType) {
    if (envCliQueryEngineType === 'binary') {
      return EngineTypeEnum.queryEngine
    }
    if (envCliQueryEngineType === 'library') {
      return EngineTypeEnum.libqueryEngine
    }
  }
  return DEFAULT_CLI_QUERY_ENGINE_BINARY_TYPE
}
export async function ensureBinariesExist() {
  const binaryDir = path.join(__dirname, '../')
  let binaryTargets: string[] | undefined
  if (process.env.PRISMA_CLI_BINARY_TARGETS) {
    binaryTargets = process.env.PRISMA_CLI_BINARY_TARGETS.split(',')
  }

  const cliQueryEngineBinaryType = getCliQueryEngineBinaryType()

  const binaries = {
    [cliQueryEngineBinaryType]: binaryDir,
    [EngineTypeEnum.migrationEngine]: binaryDir,
    [EngineTypeEnum.introspectionEngine]: binaryDir,
    [EngineTypeEnum.prismaFmt]: binaryDir,
  }
  debug(`binaries to download ${Object.keys(binaries).join(', ')}`)
  await download({
    engines: binaries,
    showProgress: true,
    version: enginesVersion,
    failSilent: false,
    binaryTargets: binaryTargets as Platform[],
  })
}

export { enginesVersion } from '@prisma/engines-version'

/**
 * This annotation is used for `node-file-trace`
 * See https://github.com/zeit/node-file-trace/issues/104
 * It's necessary to run this package standalone or within the sdk in Vercel
 * And needed for https://github.com/vercel/pkg#detecting-assets-in-source-code
 */

path.join(__dirname, '../query-engine-darwin')
path.join(__dirname, '../introspection-engine-darwin')
path.join(__dirname, '../prisma-fmt-darwin')

path.join(__dirname, '../query-engine-darwin-arm64')
path.join(__dirname, '../introspection-engine-darwin-arm64')
path.join(__dirname, '../prisma-fmt-darwin-arm64')

path.join(__dirname, '../query-engine-debian-openssl-1.0.x')
path.join(__dirname, '../introspection-engine-debian-openssl-1.0.x')
path.join(__dirname, '../prisma-fmt-debian-openssl-1.0.x')

path.join(__dirname, '../query-engine-debian-openssl-1.1.x')
path.join(__dirname, '../introspection-engine-debian-openssl-1.1.x')
path.join(__dirname, '../prisma-fmt-debian-openssl-1.1.x')

path.join(__dirname, '../query-engine-debian-openssl-3.0.x')
path.join(__dirname, '../introspection-engine-debian-openssl-3.0.x')
path.join(__dirname, '../prisma-fmt-debian-openssl-3.0.x')

path.join(__dirname, '../query-engine-rhel-openssl-1.0.x')
path.join(__dirname, '../introspection-engine-rhel-openssl-1.0.x')
path.join(__dirname, '../prisma-fmt-rhel-openssl-1.0.x')

path.join(__dirname, '../query-engine-rhel-openssl-1.1.x')
path.join(__dirname, '../introspection-engine-rhel-openssl-1.1.x')
path.join(__dirname, '../prisma-fmt-rhel-openssl-1.1.x')

path.join(__dirname, '../query-engine-rhel-openssl-3.0.x')
path.join(__dirname, '../introspection-engine-rhel-openssl-3.0.x')
path.join(__dirname, '../prisma-fmt-rhel-openssl-3.0.x')

// Node API
path.join(__dirname, '../libquery_engine-darwin.dylib.node')
path.join(__dirname, '../libquery_engine-darwin-arm64.dylib.node')
path.join(__dirname, '../libquery_engine-debian-openssl-1.0.x.so.node')
path.join(__dirname, '../libquery_engine-debian-openssl-1.1.x.so.node')
path.join(__dirname, '../libquery_engine-debian-openssl-3.0.x.so.node')
path.join(__dirname, '../libquery_engine-linux-arm64-openssl-1.0.x.so.node')
path.join(__dirname, '../libquery_engine-linux-arm64-openssl-1.1.x.so.node')
path.join(__dirname, '../libquery_engine-linux-arm64-openssl-3.0.x.so.node')
path.join(__dirname, '../libquery_engine-linux-musl.so.node')
path.join(__dirname, '../libquery_engine-rhel-openssl-1.0.x.so.node')
path.join(__dirname, '../libquery_engine-rhel-openssl-1.1.x.so.node')
path.join(__dirname, '../libquery_engine-rhel-openssl-3.0.x.so.node')
path.join(__dirname, '../query_engine-windows.dll.node')
