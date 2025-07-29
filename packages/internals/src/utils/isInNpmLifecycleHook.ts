/**
 * Checks if the current process is running in an npm lifecycle hook, excluding custom npm scripts.
 */
export function isInNpmLifecycleHook(): boolean {
  return process.env.npm_lifecycle_event !== undefined && process.env.npm_command !== 'run-script'
}
