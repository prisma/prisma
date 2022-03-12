import execa from 'execa'

export async function runGeneratorExecutable(
  executablePath: string,
  options: any,
): Promise<{ stdout: string; stderr: string }> {
  const child = execa(executablePath)

  child.stdin!.write(JSON.stringify(options) + '\n')

  return await child
}
