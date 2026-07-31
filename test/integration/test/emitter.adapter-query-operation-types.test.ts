import postgresAdapter from '@prisma-next/adapter-postgres/control';
import type { Contract } from '@prisma-next/contract/types';
import { generateContractDts } from '@prisma-next/emitter';
import { extractQueryOperationTypeImports } from '@prisma-next/framework-components/control';
import { UNBOUND_NAMESPACE_ID } from '@prisma-next/framework-components/ir';
import type { SqlStorage } from '@prisma-next/sql-contract/types';
import { sqlEmission } from '@prisma-next/sql-contract-emitter';
import { postgresCreateNamespace } from '@prisma-next/target-postgres/types';
import { applicationDomainOf } from '@repo/test-utils';
import { describe, expect, it } from 'vitest';

describe('emitter + postgres adapter descriptor', () => {
  it('surfaces adapter-declared queryOperationTypes.import in generated contract.d.ts', () => {
    const ir: Contract<SqlStorage> = {
      target: 'postgres',
      targetFamily: 'sql',
      roots: {},
      domain: applicationDomainOf({ models: {} }),
      storage: {
        storageHash: 'storage:test' as never,
        namespaces: {
          [UNBOUND_NAMESPACE_ID]: postgresCreateNamespace({
            id: UNBOUND_NAMESPACE_ID,
            entries: { table: {} },
          }),
        },
      },
      capabilities: {},
      extensions: {},
      profileHash: 'profile:test' as never,
      meta: {},
    };
    const queryOperationTypeImports = extractQueryOperationTypeImports([postgresAdapter]);

    const types = generateContractDts(
      ir,
      sqlEmission,
      [],
      { storageHash: 'h', profileHash: 'p' },
      { queryOperationTypeImports },
    );

    expect(types).toContain(
      "import type { QueryOperationTypes as PgAdapterQueryOps } from '@prisma-next/adapter-postgres/operation-types'",
    );
    expect(types).toContain('export type QueryOperationTypes = PgAdapterQueryOps');
  });
});
