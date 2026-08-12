import postgresAdapter from '@internal/adapter-postgres/control';
import { defineConfig } from '@internal/cli/config-types';
import postgresDriver from '@internal/driver-postgres/control';
import sql from '@internal/family-sql/control';
import postgres from '@internal/target-postgres/control';
import { contract } from './contract';

export default defineConfig({
  family: sql,
  target: postgres,
  adapter: postgresAdapter,
  driver: postgresDriver,
  extensions: [],
  contract: {
    source: {
      format: 'typescript',
      load: async () => ({ ok: true, value: contract }),
    },
    output: './contract.json',
  },
  db: {
    connection: '{{DB_URL}}',
  },
});
