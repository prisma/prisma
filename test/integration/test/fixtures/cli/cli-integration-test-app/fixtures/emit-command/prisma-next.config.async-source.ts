import postgresAdapter from '@internal/adapter-postgres/control';
import { defineConfig } from '@internal/cli/config-types';
import postgresDriver from '@internal/driver-postgres/control';
import sql from '@internal/family-sql/control';
import postgres from '@internal/target-postgres/control';
import { ok } from '@internal/utils/result';

export default defineConfig({
  family: sql,
  target: postgres,
  adapter: postgresAdapter,
  driver: postgresDriver,
  extensions: [],
  contract: {
    source: {
      inputs: ['./contract.ts'],
      load: async () => {
        const { contract } = await import('./contract');
        return ok(contract);
      },
    },
    output: '{{OUTPUT_DIR}}/contract.json',
  },
});
