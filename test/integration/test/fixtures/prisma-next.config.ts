import postgresAdapter from '@internal/adapter-postgres/control';
import { defineConfig } from '@internal/cli/config-types';
import sql from '@internal/family-sql/control';
import postgres from '@internal/target-postgres/control';
import { contract } from './contract';

export default defineConfig({
  family: sql,
  target: postgres,
  adapter: postgresAdapter,
  contract: {
    source: {
      load: async () => ({ ok: true, value: contract }),
    },
    output: 'contract.json',
  },
});
