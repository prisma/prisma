// Returns true if the current environment is a CI environment.
export const isCi = (): boolean => {
  const env = process.env

  // From https://github.com/watson/ci-info/blob/44e98cebcdf4403f162195fbcf90b1f69fc6e047/index.js#L54-L61
  // Evaluating at runtime makes it possible to change the values in our tests
  // This list is probably not exhaustive though `process.env.CI` should be enough
  //  but since we were using this utility in the past, we want to keep the same behavior
  return !!(
    env.CI || // Travis CI, CircleCI, Cirrus CI, GitLab CI, Appveyor, CodeShip, dsari
    env.CONTINUOUS_INTEGRATION || // Travis CI, Cirrus CI
    env.BUILD_NUMBER || // Jenkins, TeamCity
    env.RUN_ID || // TaskCluster, dsari
    // From `env` from https://github.com/watson/ci-info/blob/44e98cebcdf4403f162195fbcf90b1f69fc6e047/vendors.json
    env.APPVEYOR ||
    env.SYSTEM_TEAMFOUNDATIONCOLLECTIONURI ||
    env.AC_APPCIRCLE ||
    env.bamboo_planKey ||
    env.BITBUCKET_COMMIT ||
    env.BITRISE_IO ||
    env.BUILDKITE ||
    env.CIRCLECI ||
    env.CIRRUS_CI ||
    env.CODEBUILD_BUILD_ARN ||
    env.CF_BUILD_ID ||
    env.CI_NAME ||
    env.DRONE ||
    env.DSARI ||
    env.EAS_BUILD ||
    env.GITHUB_ACTIONS ||
    env.GITLAB_CI ||
    env.GOCD ||
    env.LAYERCI ||
    env.HUDSON ||
    env.JENKINS ||
    env.MAGNUM ||
    env.NETLIFY ||
    env.NEVERCODE ||
    env.RENDER ||
    env.SAILCI ||
    env.SEMAPHORE ||
    env.SCREWDRIVER ||
    env.SHIPPABLE ||
    env.TDDIUM ||
    env.STRIDER ||
    env.TEAMCITY_VERSION ||
    env.TRAVIS ||
    env.NOW_BUILDER ||
    env.APPCENTER_BUILD_ID ||
    false
  )
}
