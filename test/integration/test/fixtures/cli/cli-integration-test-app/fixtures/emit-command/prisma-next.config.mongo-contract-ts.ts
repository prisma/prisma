import mongoAdapter from '@internal/adapter-mongo/control';
import { defineConfig } from '@internal/cli/config-types';
import type { Contract } from '@internal/contract/types';
import { mongoFamilyDescriptor } from '@internal/family-mongo/control';
import { mongoTargetDescriptor } from '@internal/target-mongo/control';
import { ok } from '@internal/utils/result';
import { contract } from './contract.mongo';

export default defineConfig({
  family: mongoFamilyDescriptor,
  target: mongoTargetDescriptor,
  adapter: mongoAdapter,
  contract: {
    source: {
      load: async () => ok(contract as Contract),
    },
    output: 'output/contract.json',
  },
});
