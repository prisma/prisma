/**
 * `mongodb-memory-server` downloads and extracts a `mongod` binary the first
 * time it runs, so the suite needs far longer than vitest's default. CI scales
 * it with `TEST_TIMEOUT_MULTIPLIER`, the same knob the rest of the repository's
 * suites read.
 *
 * The value is local to this example on purpose: the example exists to show
 * what an application installs, and an application has no access to the
 * repository's own test helpers.
 */
const BASE_MS = 60_000;

function multiplier(): number {
  return Number.parseFloat(process.env['TEST_TIMEOUT_MULTIPLIER'] || '1') || 1;
}

export const mongoMemoryServerTimeoutMs = Math.round(BASE_MS * multiplier());
