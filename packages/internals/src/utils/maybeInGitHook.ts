/**
 * Checks if we may be running inside a git hook (such as pre-commit).
 *
 * It can give false positives in edge cases, if user has `GIT_EXEC_PATH`,
 * `GIT_DIR`, `GIT_INDEX_FILE`, or `GIT_PREFIX` environment variable set in
 * their shell before running the git command (which is rare but possible).
 * This function should only be used where such false positives are acceptable.
 */
export function maybeInGitHook(): boolean {
  return (
    process.env.GIT_EXEC_PATH !== undefined ||
    process.env.GIT_DIR !== undefined ||
    process.env.GIT_INDEX_FILE !== undefined ||
    process.env.GIT_PREFIX !== undefined
  )
}
