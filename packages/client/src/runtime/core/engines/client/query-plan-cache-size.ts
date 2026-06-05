const DEFAULT_QUERY_PLAN_CACHE_MAX_SIZE = 1000
const DEFAULT_EDGE_QUERY_PLAN_CACHE_MAX_SIZE = 100

export function getQueryPlanCacheMaxSize(maxSize: number | undefined): number | undefined {
  if (maxSize === 0) {
    return undefined
  }

  if (maxSize !== undefined) {
    return maxSize
  }

  return TARGET_BUILD_TYPE === 'wasm-compiler-edge'
    ? DEFAULT_EDGE_QUERY_PLAN_CACHE_MAX_SIZE
    : DEFAULT_QUERY_PLAN_CACHE_MAX_SIZE
}
