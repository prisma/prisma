import { defineConfig } from '@repo/tsdown';

export default defineConfig({
  entry: {
    index: 'src/exports/index.ts',
    'exports/contract-free': 'src/exports/contract-free.ts',
    'internal/on-validated-contract': 'src/exports/internal-on-validated-contract.ts',
  },
});
