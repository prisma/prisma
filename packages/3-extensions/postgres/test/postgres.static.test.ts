import { buildNamespacedEnums, type NamespacedEnums } from '@internal/contract/enum-accessor';
import type { Contract } from '@internal/contract/types';
import type { SqlStorage } from '@internal/sql-contract/types';
import { createContract } from '@repo/test-utils';
import { describe, expect, it } from 'vitest';
import postgresStatic from '../src/static/postgres-static';

const contract = createContract<SqlStorage>();

describe('postgresStatic({ contractJson })', () => {
  it('context carries the contract (merged capabilities view)', () => {
    const result = postgresStatic<typeof contract>({ contractJson: contract });
    expect(result.context.contract).toBeDefined();
    expect(result.context.contract.target).toBe(contract.target);
  });

  it('contract matches the deserialized contractJson', () => {
    const result = postgresStatic<typeof contract>({ contractJson: contract });
    expect(result.contract.target).toBe(contract.target);
    expect(result.contract.targetFamily).toBe(contract.targetFamily);
    expect(result.contract.domain).toEqual(contract.domain);
    expect(result.contract.profileHash).toBe(contract.profileHash);
  });

  it('enums matches what buildNamespacedEnums produces', () => {
    const result = postgresStatic<typeof contract>({ contractJson: contract });
    const allNamespaced = buildNamespacedEnums(contract.domain, (codecId) =>
      result.context.contractCodecs.forCodecRef({ codecId }),
    ) as NamespacedEnums<Contract<SqlStorage>>;

    expect(result.enums).toMatchObject(allNamespaced);
  });
});
