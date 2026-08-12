import postgresAdapter from '@internal/adapter-postgres/control';
import { defineConfig } from '@internal/cli/config-types';
import sql from '@internal/family-sql/control';
import { prismaContract } from '@internal/sql-contract-psl/provider';
import postgres from '@internal/target-postgres/control';
import { postgresCreateNamespace } from '@internal/target-postgres/types';

export default defineConfig({
  family: sql,
  target: postgres,
  adapter: postgresAdapter,
  contract: prismaContract('src/contract/contract.prisma', {
    target: postgres,
    createNamespace: postgresCreateNamespace,
    defaultControlPolicy: 'external',
  }),
  migrations: {
    dir: 'migrations',
  },
});
