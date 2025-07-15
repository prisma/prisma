import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [tsconfigPaths({ ignoreConfigErrors: true })],
  test: {
    include: ['**/*.test.ts'],
    unstubEnvs: true,
    setupFiles: ['./vitest.setup.ts'],
  },
})
