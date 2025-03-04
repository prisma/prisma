// Why is this in getPlatform... because of our dependency tree

import type { BinaryTarget } from './binaryTargets'

const NODE_API_QUERY_ENGINE_URL_BASE = 'libquery_engine'

/**
 * Gets Node-API Library name depending on the binary target
 * @param binaryTarget
 * @param type  `fs` gets name used on the file system, `url` gets the name required to download the library from S3
 * @returns
 */
export function getNodeAPIName(binaryTarget: BinaryTarget, type: 'url' | 'fs') {
  const isUrl = type === 'url'
  if (binaryTarget.includes('windows')) {
    return isUrl ? 'query_engine.dll.node' : `query_engine-${binaryTarget}.dll.node`
  }if (binaryTarget.includes('darwin')) {
    return isUrl
      ? `${NODE_API_QUERY_ENGINE_URL_BASE}.dylib.node`
      : `${NODE_API_QUERY_ENGINE_URL_BASE}-${binaryTarget}.dylib.node`
  }
    return isUrl
      ? `${NODE_API_QUERY_ENGINE_URL_BASE}.so.node`
      : `${NODE_API_QUERY_ENGINE_URL_BASE}-${binaryTarget}.so.node`
}
