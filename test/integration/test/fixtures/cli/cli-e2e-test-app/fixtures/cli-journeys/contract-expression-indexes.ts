// Hand-assembled through the contract factory layer: expression and partial
// indexes have no PSL/TS authoring parameters yet (slice 2), so the storage
// entities are built directly from index inputs — the only surface that can
// express them today.
import { type Contract, coreHash, profileHash } from '@prisma-next/contract/types';
import { SqlStorage } from '@prisma-next/sql-contract/types';
import { postgresCreateNamespace } from '@prisma-next/target-postgres/types';

export const contract: Contract<SqlStorage> = {
  target: 'postgres',
  targetFamily: 'sql',
  profileHash: profileHash('expression-indexes'),
  storage: new SqlStorage({
    storageHash: coreHash('e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0'),
    namespaces: {
      public: postgresCreateNamespace({
        id: 'public',
        entries: {
          table: {
            doc: {
              columns: {
                id: { nativeType: 'int4', codecId: 'pg/int4@1', nullable: false },
                email: { nativeType: 'text', codecId: 'pg/text@1', nullable: false },
                deleted_at: {
                  nativeType: 'timestamptz',
                  codecId: 'pg/timestamptz@1',
                  nullable: true,
                },
              },
              primaryKey: { columns: ['id'] },
              uniques: [],
              indexes: [
                { name: 'doc_email_lower_idx', expression: 'lower(email)', unique: false },
                {
                  name: 'doc_email_active_idx',
                  columns: ['email'],
                  where: '(deleted_at IS NULL)',
                  unique: false,
                },
                { name: 'doc_email_eq_key', expression: 'lower(email)', unique: true },
              ],
              foreignKeys: [],
            },
          },
        },
      }),
    },
  }),
  domain: { namespaces: { __unbound__: { models: {} } } },
  roots: {},
  capabilities: {},
  extensions: {},
  meta: {},
};
