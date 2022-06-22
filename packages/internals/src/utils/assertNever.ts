/**
 * Utility function to ensure exhaustive checks for union types.
 *
 * @example
 *   ```ts
 *   declare const fruit: 'Apple' | 'Orange'
 *
 *   switch (fruit) {
 *     case 'Apple:
 *       // do apple things
 *       break;
 *     case 'Orange:
 *       // do orange things
 *       break;
 *     default:
 *       // in case `fruit` type will expand in the future,
 *       // we'll get a compile-time error here, listing all unhandled
 *       // cases
 *       assertNever(fruit, 'Unknown fruit')
 *   }
 *   ```
 * @param arg variable of the any union type. By the time `assertNever` is called
 * all possible cases of this union must already be handled
 * @param errorMessage error message to throw in runtime. Normally, should never happen
 * unless compile-time check is skipped
 */
export function assertNever(arg: never, errorMessage: string): never {
  throw new Error(errorMessage)
}
