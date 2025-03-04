export function parseAWSNodejsRuntimeEnvVarVersion() {
  const runtimeEnvVar = process.env.AWS_LAMBDA_JS_RUNTIME
  if (!runtimeEnvVar || runtimeEnvVar === '') return null

  try {
    const runtimeRegex = /^nodejs(\d+).x$/
    const match = runtimeRegex.exec(runtimeEnvVar)
    if (match) {
      return Number.parseInt(match[1])
    }
  } catch (_e) {
    console.error(
      `We could not parse the AWS_LAMBDA_JS_RUNTIME env var with the following value: ${runtimeEnvVar}. This was silently ignored.`,
    )
  }

  return null
}
