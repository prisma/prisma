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
    // From `env` from v4.0.0 https://github.com/watson/ci-info/blob/3e1488e98680f1f776785fe8708a157b7f00e568/vendors.json
    env.AGOLA_GIT_REF ||
    env.AC_APPCIRCLE ||
    env.APPVEYOR ||
    env.CODEBUILD ||
    env.TF_BUILD ||
    env.bamboo_planKey ||
    env.BITBUCKET_COMMIT ||
    env.BITRISE_IO ||
    env.BUDDY_WORKSPACE_ID ||
    env.BUILDKITE ||
    env.CIRCLECI ||
    env.CIRRUS_CI ||
    env.CF_BUILD_ID ||
    env.CM_BUILD_ID ||
    env.CI_NAME ||
    env.DRONE ||
    env.DSARI ||
    env.EARTHLY_CI ||
    env.EAS_BUILD ||
    env.GERRIT_PROJECT ||
    env.GITEA_ACTIONS ||
    env.GITHUB_ACTIONS ||
    env.GITLAB_CI ||
    env.GOCD ||
    env.BUILDER_OUTPUT ||
    env.HARNESS_BUILD_ID ||
    env.JENKINS_URL ||
    env.BUILD_ID ||
    env.LAYERCI ||
    env.MAGNUM ||
    env.NETLIFY ||
    env.NEVERCODE ||
    env.PROW_JOB_ID ||
    env.RELEASE_BUILD_ID ||
    env.RENDER ||
    env.SAILCI ||
    env.HUDSON ||
    env.JENKINS_URL ||
    env.BUILD_ID ||
    env.SCREWDRIVER ||
    env.SEMAPHORE ||
    env.SOURCEHUT ||
    env.STRIDER ||
    env.TASK_ID ||
    env.RUN_ID ||
    env.TEAMCITY_VERSION ||
    env.TRAVIS ||
    env.VELA ||
    env.NOW_BUILDER ||
    // See https://github.com/prisma/prisma/issues/22380 for why we commented it out
    // Users deploying on Vercel might have this env var set in the local dev env
    // env.VERCEL ||
    env.APPCENTER_BUILD_ID ||
    env.CI_XCODE_PROJECT ||
    env.XCS ||
    false
  )
}
