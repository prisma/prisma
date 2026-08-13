import mongoAdapter from '@internal/adapter-mongo/control';
import { defineConfig as ormConfig } from '@internal/cli/config-types';
import { mongoFamilyDescriptor } from '@internal/family-mongo/control';
import { mongoContract } from '@internal/mongo-contract-psl/provider';
import { mongoTargetDescriptor } from '@internal/target-mongo/control';
import { defineConfig } from '@prisma/cli-engine';

export default defineConfig({
  orm: ormConfig({
    family: mongoFamilyDescriptor,
    target: mongoTargetDescriptor,
    adapter: mongoAdapter,
    contract: mongoContract('./contract.prisma', {
      output: 'output/contract.json',
    }),
  }),
});
