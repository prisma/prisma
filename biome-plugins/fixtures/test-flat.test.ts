// Fixture (d): flat .test.ts file with bare `as` — no-bare-cast must NOT fire.
// The plugin excludes **/*.test.{ts,tsx,mts,cts} paths.

declare const input: unknown;

export const x = input as string;
export const y = input as unknown as number;
