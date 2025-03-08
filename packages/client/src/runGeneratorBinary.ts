import execa from 'execa'

export async function runGeneratorBinary(
  binaryPath: string,
  options: any,
): Promise<{ stdout: string; stderr: string }> {
  const child = execa(binaryPath)

  child.stdin!.write(`${JSON.stringify(options)}\n`)

  return await child
}
