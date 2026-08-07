import type { SqlAggregateDescriptorRegistry } from '@internal/sql-relational-core/query-lane-context';

const operationNamesByRegistry = new WeakMap<SqlAggregateDescriptorRegistry, readonly string[]>();

/**
 * The operation vocabulary the composed registry contributes, in contribution
 * order — the runtime mirror of the contract's emitted aggregate map, both
 * settled from the same contributed descriptors. Cached per registry: the set
 * is fixed at composition time, and every collection construction reads it.
 */
export function aggregateOperationNames(
  registry: SqlAggregateDescriptorRegistry,
): readonly string[] {
  const cached = operationNamesByRegistry.get(registry);
  if (cached !== undefined) {
    return cached;
  }
  const names: string[] = [];
  const seen = new Set<string>();
  for (const { operation } of registry.values()) {
    if (seen.has(operation)) {
      continue;
    }
    seen.add(operation);
    names.push(operation);
  }
  operationNamesByRegistry.set(registry, names);
  return names;
}
