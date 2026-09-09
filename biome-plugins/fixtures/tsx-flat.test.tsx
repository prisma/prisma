// Fixture: flat .test.tsx file with bare `as` and bare `throw new Error()` —
// neither no-bare-cast nor no-bare-throw must fire.

declare const input: unknown;

export const x = input as string;

export function throwsInTest() {
  throw new Error();
}
