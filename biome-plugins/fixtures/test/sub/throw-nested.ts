// Fixture (d): file under a nested test/ directory — no-bare-throw must NOT fire.
// Validates that the plugin's r".*/test/.*\.ts" regex matches arbitrary depth
// under a test/ directory, matching biome's existing **/test/**/*.ts glob.

export function throwsInNestedTestDir() {
  throw new Error();
}
