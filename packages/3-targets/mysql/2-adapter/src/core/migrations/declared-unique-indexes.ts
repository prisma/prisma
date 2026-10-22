import type { DeclaresUniqueIndex } from './introspection';

type Loose = Readonly<Record<string, unknown>>;

function isLoose(value: unknown): value is Loose {
  return typeof value === 'object' && value !== null;
}

function child(value: unknown, key: string): Loose | undefined {
  const found = isLoose(value) ? value[key] : undefined;
  return isLoose(found) ? found : undefined;
}

function tableIndexKey(tableName: string, indexName: string): string {
  return JSON.stringify([tableName, indexName]);
}

/** The unique indexes the contract handed to introspection declares, read from every contract space it holds. */
export function declaredUniqueIndexes(contract: unknown): DeclaresUniqueIndex {
  const contracts =
    isLoose(contract) && Array.isArray(contract['contracts']) ? contract['contracts'] : [contract];
  const declared = new Set<string>();
  for (const space of contracts) {
    for (const namespace of Object.values(child(child(space, 'storage'), 'namespaces') ?? {})) {
      for (const [tableName, table] of Object.entries(
        child(child(namespace, 'entries'), 'table') ?? {},
      )) {
        const indexes = isLoose(table) ? table['indexes'] : undefined;
        for (const index of Array.isArray(indexes) ? indexes : []) {
          if (isLoose(index) && index['unique'] === true && typeof index['name'] === 'string') {
            declared.add(tableIndexKey(tableName, index['name']));
          }
        }
      }
    }
  }
  return (tableName, indexName) => declared.has(tableIndexKey(tableName, indexName));
}
