// Fixture (a): bare `as` casts — no-bare-cast must fire on both.
// This is a production-shaped file (not a test file), so both patterns are caught.

declare const input: unknown;

// bare `as Foo` — rule fires here
export const x = input as string;

// `as unknown as Foo` (double cast) — rule fires on each `as` token
export const y = input as unknown as number;
