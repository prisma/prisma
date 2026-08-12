import { isCI as ciInfoIsCI } from 'ci-info';

/**
 * Returns true when the process is running in any CI environment recognised
 * by the `ci-info` package. The single source of truth for CI detection
 * across this CLI — colour-output suppression and telemetry-skip both call
 * this helper, so neither path drifts from the other when a new CI provider
 * is added upstream.
 *
 * `ci-info` checks the standard `CI=true` marker plus dozens of
 * provider-specific environment variables (Buildkite, Jenkins, Drone,
 * Bitbucket Pipelines, Azure Pipelines, AWS CodeBuild, …) that the raw
 * `process.env.CI` read misses.
 *
 */
export function isCI(): boolean {
  return ciInfoIsCI;
}
