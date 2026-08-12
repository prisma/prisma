import postgresAdapter from '@internal/adapter-postgres/control';
import type { Contract } from '@internal/contract/types';
import { generateContractDts } from '@internal/emitter';
import { extractQueryOperationTypeImports } from '@internal/framework-components/control';
import { UNBOUND_NAMESPACE_ID } from '@internal/framework-components/ir';
import type { SqlStorage } from '@internal/sql-contract/types';
import { sqlEmission } from '@internal/sql-contract-emitter';
import { postgresCreateNamespace } from '@internal/target-postgres/types';
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
      "import type { QueryOperationTypes as PgAdapterQueryOps } from '@internal/adapter-postgres/operation-types'",
    );
    expect(types).toContain('export type QueryOperationTypes = PgAdapterQueryOps');
  });
});
