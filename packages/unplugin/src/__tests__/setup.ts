const shouldMute = !process.env.DEBUG_TEST_LOGS

if (shouldMute) {
  const noop = () => {}

  // Silence noisy test output unless DEBUG_TEST_LOGS is set.
  console.log = noop
  console.info = noop
  console.warn = noop
  console.error = noop
}
