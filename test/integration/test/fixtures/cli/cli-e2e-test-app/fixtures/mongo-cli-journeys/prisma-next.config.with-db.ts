import mongoAdapter from '@internal/adapter-mongo/control';
import { defineConfig } from '@internal/cli/config-types';
import mongoDriver from '@internal/driver-mongo/control';
import { mongoFamilyDescriptor } from '@internal/family-mongo/control';
import { mongoTargetDescriptor } from '@internal/target-mongo/control';
import { contract } from './contract';

export default defineConfig({
  family: mongoFamilyDescriptor,
  target: mongoTargetDescriptor,
  adapter: mongoAdapter,
  driver: mongoDriver,
  extensions: [],
  contract: {
    source: {
      load: async () => ({ ok: true as const, value: contract }),
    },
    output: 'output/contract.json',
  },
  db: {
    connection: '{{DB_URL}}',
  },
  migrations: {
    dir: 'migrations',
  },
});
