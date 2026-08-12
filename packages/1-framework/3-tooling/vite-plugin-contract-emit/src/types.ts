/**
 * Options for the Prisma Vite plugin.
 */
export interface PrismaVitePluginOptions {
  /**
   * Debounce delay in milliseconds for re-emit on file changes.
   * @default 150
   */
  readonly debounceMs?: number;
  /**
   * Log level for plugin output.
   * - 'silent': No output
   * - 'info': Success messages and errors
   * - 'debug': Verbose output including watched files
   * @default 'info'
   */
  readonly logLevel?: 'silent' | 'info' | 'debug';
}
