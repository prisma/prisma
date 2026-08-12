import mongoAdapter from '@internal/adapter-mongo/control';
import { defineConfig } from '@internal/cli/config-types';
import { mongoFamilyDescriptor } from '@internal/family-mongo/control';
import { mongoContract } from '@internal/mongo-contract-psl/provider';
import { mongoTargetDescriptor } from '@internal/target-mongo/control';

export default defineConfig({
  family: mongoFamilyDescriptor,
  target: mongoTargetDescriptor,
  adapter: mongoAdapter,
  contract: mongoContract('./contract.prisma', {
    output: 'output/contract.json',
  }),
});
