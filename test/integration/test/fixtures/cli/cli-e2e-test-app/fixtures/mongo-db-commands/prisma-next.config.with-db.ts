import mongoAdapter from '@internal/adapter-mongo/control';
import { defineConfig } from '@internal/cli/config-types';
import mongoDriver from '@internal/driver-mongo/control';
import { mongoFamilyDescriptor } from '@internal/family-mongo/control';
import { mongoTargetDescriptor } from '@internal/target-mongo/control';

export default defineConfig({
  family: mongoFamilyDescriptor,
  target: mongoTargetDescriptor,
  adapter: mongoAdapter,
  driver: mongoDriver,
  extensions: [],
  contract: {
    source: {
      load: async () => ({ ok: true, value: {} }),
    },
    output: 'output/contract.json',
  },
  db: {
    connection: '{{MONGO_URI}}',
  },
});
