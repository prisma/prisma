import { defineConfig } from '@internal/postgres/config';

export default defineConfig({ contract: './contract.prisma', output: 'generated' });
