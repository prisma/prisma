import { prismaVitePlugin } from '@prisma/orm-postgres/vite-plugin-contract-emit';
import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), prismaVitePlugin()],
});
