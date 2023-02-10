// Returns CI variable if the current environment is a CI environment.
export const hasCiVariable = (): string | false => {
  return KEYS.find((key) => process.env[key]) ?? false
}

// From https://github.com/watson/ci-info/blob/44e98cebcdf4403f162195fbcf90b1f69fc6e047/index.js#L54-L61
// Evaluating at runtime makes it possible to change the values in our tests
// This list is probably not exhaustive though `process.env.CI` should be enough
//  but since we were using this utility in the past, we want to keep the same behavior

const KEYS = [
  'CI', // Travis CI, CircleCI, Cirrus CI, GitLab CI, Appveyor, CodeShip, dsari
  'CONTINUOUS_INTEGRATION', // Travis CI, Cirrus CI
  'BUILD_NUMBER', // Jenkins, TeamCity
  'RUN_ID', // TaskCluster, dsari
  // From `env` from https://github.com/watson/ci-info/blob/44e98cebcdf4403f162195fbcf90b1f69fc6e047/vendors.json
  'APPVEYOR',
  'SYSTEM_TEAMFOUNDATIONCOLLECTIONURI',
  'AC_APPCIRCLE',
  'bamboo_planKey',
  'BITBUCKET_COMMIT',
  'BITRISE_IO',
  'BUILDKITE',
  'CIRCLECI',
  'CIRRUS_CI',
  'CODEBUILD_BUILD_ARN',
  'CF_BUILD_ID',
  'CI_NAME',
  'DRONE',
  'DSARI',
  'EAS_BUILD',
  'GITHUB_ACTIONS',
  'GITLAB_CI',
  'GOCD',
  'LAYERCI',
  'HUDSON',
  'JENKINS',
  'MAGNUM',
  'NETLIFY',
  'NEVERCODE',
  'RENDER',
  'SAILCI',
  'SEMAPHORE',
  'SCREWDRIVER',
  'SHIPPABLE',
  'TDDIUM',
  'STRIDER',
  'TEAMCITY_VERSION',
  'TRAVIS',
  'NOW_BUILDER',
  'APPCENTER_BUILD_ID',
]
