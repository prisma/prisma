const featureFlagMap = {
  transactionApi: 'transaction',
  aggregateApi: 'aggregations',
}

/**
 * TODO: remove this
 * @deprecated
 * @param features
 * @returns
 */
export function mapPreviewFeatures(features?: string[]): string[] {
  if (Array.isArray(features) && features.length > 0) {
    return features.map((f) => featureFlagMap[f] ?? f)
  }

  return []
}
