// Fixture (c): flat .test.ts file with bare `throw new Error()` — no-bare-throw must NOT fire.
// The plugin's file() predicate excludes **/*.test.ts paths.

export function throwsInTest() {
  throw new Error();
}
