import { prismaVitePlugin } from '@internal/vite-plugin-contract-emit';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [prismaVitePlugin('prisma.config.ts', { logLevel: 'silent' })],
});
