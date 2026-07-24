import { ContractValidationError } from '@prisma-next/contract/contract-validation-error';
import type { Contract } from '@prisma-next/contract/types';
import { type } from 'arktype';
import type { IndexTypeRegistry } from './index-types';
import type { SqlStorage } from './types';

export function validateIndexTypes(
  contract: Contract<SqlStorage>,
  indexTypeRegistry: IndexTypeRegistry,
): void {
  for (const [namespaceId, ns] of Object.entries(contract.storage.namespaces)) {
    for (const [tableName, table] of Object.entries(ns.entries.table ?? {})) {
      for (const index of table.indexes) {
        if (index.type === undefined && index.options !== undefined) {
          throw new ContractValidationError(
            `Namespace "${namespaceId}" table "${tableName}" index "${index.name}" has options without a type`,
            'storage',
          );
        }
        if (index.type === undefined) continue;
        const entry = indexTypeRegistry.get(index.type);
        if (entry === undefined) {
          throw new ContractValidationError(
            `Namespace "${namespaceId}" table "${tableName}" index "${index.name}" uses unregistered index type "${index.type}"`,
            'storage',
          );
        }
        const optionsValue = index.options ?? {};
        const result = entry.options(optionsValue);
        if (result instanceof type.errors) {
          throw new ContractValidationError(
            `Namespace "${namespaceId}" table "${tableName}" index "${index.name}" has invalid options for type "${index.type}": ${result.summary}`,
            'storage',
          );
        }
      }
    }
  }
}
