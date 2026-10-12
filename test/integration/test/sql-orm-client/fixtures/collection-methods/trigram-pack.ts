import type { SqlControlExtensionDescriptor } from '@internal/family-sql/control';
import { defineIndexTypes } from '@internal/sql-contract/index-types';
import { type } from 'arktype';

/** A test-only extension pack that owns the `test/trigram` index type. */
export const trigramPack = {
  kind: 'extension',
  id: 'test-trigram',
  familyId: 'sql',
  targetId: 'postgres',
  version: '0.0.1',
  indexTypes: defineIndexTypes().add('test/trigram', { options: type('object') }),
} as const;

export const trigramControl: SqlControlExtensionDescriptor<'postgres'> = {
  ...trigramPack,
  create: () => ({ familyId: 'sql', targetId: 'postgres' }),
};
