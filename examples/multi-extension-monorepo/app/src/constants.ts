/**
 * Stable identifiers for the application contract space, shared by the
 * PSL contract source (`@@map("app_user")`) and tests that need to
 * reference the on-disk table name without re-parsing the contract.
 */

export const APP_USER_TABLE = 'app_user' as const;
