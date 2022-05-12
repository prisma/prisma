// eslint-disable-next-line no-unused-vars
module.exports = async function (globalConfig, projectConfig) {
  // TODO: it'd be better not to have too many event listeners created by code running in tests
  process.setMaxListeners(200)
}
