import { defineConfig } from '@repo/tsdown';

export default defineConfig({
  entry: {
    index: 'src/exports/index.ts',
    'mongodb-types': 'src/exports/mongodb-types.ts',
  },
});
