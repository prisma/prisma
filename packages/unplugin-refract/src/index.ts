/**
 * unplugin-refract - The PRIMARY blessed path for Refract development
 *
 * Provides virtual modules for clean .refract/types imports that work
 * like Next.js and React Router 7 patterns.
 */

export { unpluginRefract as default } from './core.js'
export { unpluginRefract } from './core.js'
export type * from './types.js'

// Re-export for convenience
export { unpluginRefract as refract } from './core.js'
