// Fixture (a): bare `throw new Error(...)` — no-bare-throw must fire.
// This is a production-shaped file (not a test file), so the throw is caught.

export function parseConfig(raw: string): unknown {
  if (raw.length === 0) {
    throw new Error('config is empty');
  }
  return JSON.parse(raw);
}
