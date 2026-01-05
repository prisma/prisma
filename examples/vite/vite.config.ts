import { defineConfig } from 'vite'
import refract from 'unplugin-refract/vite'

export default defineConfig({
  clearScreen: false,
  plugins: [
    refract({
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
