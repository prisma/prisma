// Fixture (c): flat .test.ts file with bare `throw new Error()` — no-bare-throw must NOT fire.
// The plugin excludes **/*.test.{ts,tsx,mts,cts} paths.

export function throwsInTest() {
  throw new Error();
}
