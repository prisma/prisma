import { defineContract, field, model } from '@prisma-next/sql-contract-ts/contract-builder';
import { int4Column, textColumn } from '@repo/test-utils/column-descriptors';
// @ts-expect-error - This import is intentionally disallowed for testing
import { something } from 'some-other-package';
import { createTestSqlNamespace } from '../../../../../2-sql/1-core/contract/test/test-support';
import { postgresPack } from '../helpers/postgres-pack';
import { sqlFamilyPack } from '../helpers/sql-family-pack';

// Reference the disallowed import so esbuild's TypeScript loader cannot
// strip it as unused. Without a real reference esbuild elides the import
// before any plugin's `onResolve` fires, defeating the allowlist gate.
void something;

export const contract = defineContract({
  family: sqlFamilyPack,
  target: postgresPack,
  createNamespace: createTestSqlNamespace,
  models: {
    User: model('User', {
      fields: {
        id: field.column(int4Column).id(),
        email: field.column(textColumn),
      },
    }).sql({ table: 'user' }),
  },
});
