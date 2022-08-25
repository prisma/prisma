import ci from 'ci-info'

// Returns true if the current environment is a CI environment.
export const isCi = (): boolean => {
  // Check CI and GITHUB_ACTIONS env vars
  // It makes it possible to change the values in our tests
  return Boolean(process.env.CI) || Boolean(process.env.GITHUB_ACTIONS) || ci.isCI
}
