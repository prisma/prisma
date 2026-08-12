import { prismaVitePlugin } from '@prisma/orm-postgres/vite-plugin-contract-emit';
import { reactRouter } from '@react-router/dev/vite';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [prismaVitePlugin(), reactRouter(), tsconfigPaths()],
});
