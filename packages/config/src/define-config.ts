import type { OrkConfig } from './types.js'

/**
 * Type-safe helper for defining Ork configuration
 * Provides IntelliSense and type checking for config files
 *
 * @example
 * ```ts
 * export default defineConfig({
 *   datasource: {
 *     provider: 'postgresql',
 *     url: process.env.DATABASE_URL!
 *   }
 * })
 * ```
 */
export function defineConfig(config: OrkConfig): OrkConfig {
  return config
}
