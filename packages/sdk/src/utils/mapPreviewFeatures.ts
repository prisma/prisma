const featureFlagMap = {
  transactionApi: 'transaction',
  aggregateApi: 'aggregations',
}

export function mapPreviewFeatures(features?: string[]): string[] {
  if (Array.isArray(features) && features.length > 0) {
    return features.map((f) => featureFlagMap[f] ?? f)
  }

  return []
}
