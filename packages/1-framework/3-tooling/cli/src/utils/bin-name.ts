/**
 * The binary this package installs. Next-action commands are authored with a
 * `{bin}` placeholder and rendered against this name, so no library-layer
 * error hardcodes it.
 *
 * `test/output.next-actions.test.ts` asserts this stays equal to the sole key
 * of the package manifest's `bin` map.
 */
export const BIN_NAME = 'prisma-next';
