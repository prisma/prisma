/**
 * Assertion function for internal consistency checks that should never fail
 * in the correct code. It's purpose is pretty much:
 * - ensuring we get more helpful error message if invariant does not hold due to a bug
 * - have a better way of dealing with overly broad type definition than typecasting to `any`
 * or more narrow type.
 *
 * This function should be for assertions only on the values where we control both the input and the output: engine to client, generator to generated client, etc.
 * Don't use this function for assertion for any external input.
 *
 * @param condition
 * @param message
 */
export function assertAlways(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(
      `${message}. This should never happen. If you see this error, please, open an issue at https://pris.ly/prisma-prisma-bug-report`,
    )
  }
}
