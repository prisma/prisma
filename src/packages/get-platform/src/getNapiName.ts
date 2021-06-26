// Why is this in getPlatform... because of our dependency tree

import { Platform } from './platforms'

export const NAPI_QUERY_ENGINE_URL_BASE = 'libquery_engine'

/**
 * Gets Node-API Library name depending on your platform
 * @param platform
 * @param type  `fs` gets name used on the file system, `url` gets the name required to download the library from S3
 * @returns
 */
export function getNapiName(platform: Platform, type: 'url' | 'fs') {
  const isUrl = type === 'url'
  if (platform.includes('windows')) {
    return isUrl ? `query_engine.dll.node` : `query_engine-${platform}.dll.node`
  } else if (
    platform.includes('linux') ||
    platform.includes('debian') ||
    platform.includes('rhel')
  ) {
    return isUrl
      ? `${NAPI_QUERY_ENGINE_URL_BASE}.so.node`
      : `${NAPI_QUERY_ENGINE_URL_BASE}-${platform}.so.node`
  } else if (platform.includes('darwin')) {
    return isUrl
      ? `${NAPI_QUERY_ENGINE_URL_BASE}.dylib.node`
      : `${NAPI_QUERY_ENGINE_URL_BASE}-${platform}.dylib.node`
  } else {
    throw new Error(
      `NAPI is currently not supported on your platform: ${platform}`,
    )
  }
}
