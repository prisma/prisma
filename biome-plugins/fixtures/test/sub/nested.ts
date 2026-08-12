// Fixture (e): file under a nested test/ directory — no-bare-cast must NOT fire.
// Validates that the plugin's r".*/test/.*\.ts" regex matches arbitrary depth
// under a test/ directory, matching biome's existing **/test/**/*.ts glob.

declare const input: unknown;

export const x = input as string;
export const y = input as unknown as number;
