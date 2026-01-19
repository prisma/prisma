import ork from 'unplugin-ork/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  clearScreen: false,
  plugins: [
    ork({
      schema: './schema.prisma',
      debug: false,
      preserveLogs: true,
      autoGenerateClient: true,
      autoMigrate: true,
      autoMigrateMode: 'safe',
      onSchemaChange() {},
    }),
  ],
})
