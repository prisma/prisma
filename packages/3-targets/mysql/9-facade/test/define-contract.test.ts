import { UNBOUND_NAMESPACE_ID } from '@internal/framework-components/ir';
import { describe, expect, it } from 'vitest';
import { defineContract, enumType, member } from '../src/exports/contract-builder';

describe('defineContract for MySQL', () => {
  it('builds a contract for target mysql whose enum column lists its members', () => {
    const Role = enumType(
      'Role',
      { codecId: 'mysql/enum@1' },
      member('USER', 'USER'),
      member('ADMIN', 'ADMIN'),
    );
    const contract = defineContract({ enums: { Role } }, ({ field: f, model: m }) => ({
      models: {
        User: m('User', {
          fields: {
            id: f.column({ codecId: 'mysql/int@1' }).id(),
            role: f.namedType(Role),
          },
        }),
      },
    }));
    const table = contract.storage.namespaces[UNBOUND_NAMESPACE_ID]?.entries.table?.['User'];
    expect({
      target: contract.target,
      kind: contract.storage.namespaces[UNBOUND_NAMESPACE_ID]?.kind,
      role: (table?.columns['role'] as { readonly typeParams?: unknown } | undefined)?.typeParams,
    }).toEqual({ target: 'mysql', kind: 'mysql-namespace', role: { values: ['USER', 'ADMIN'] } });
  });
});
