/**
 * unplugin-ork - The recommended path for Ork development
 *
 * Provides virtual modules for clean .ork/types imports that work
 * like Next.js and React Router 7 patterns.
 */

export { unpluginOrk as default } from './core.js'
export { unpluginOrk } from './core.js'
export type * from './types.js'

// Re-export for convenience
export { unpluginOrk as ork } from './core.js'
