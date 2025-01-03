async function getProcessObject() {
  if (typeof process === 'object') return process

  // On deno 1.X the process global is not directly available but has to be imported explicitly.
  try {
    return await import('node:process')
  } catch (_) {
    return null
  }
}

export async function getTypescriptVersion(): Promise<string> {
  try {
    // On node.js this will import the project defined typescript package.
    // On bun this will import the bun bundled typescript package.
    return (await import('typescript')).default.version
  } catch (_) {
    // On deno the dynamic import of typescript will fail but typescript is natively available and its version is available in process.versions.
    // If none of this worked typescript is likely not installed / available.
    return (await getProcessObject())?.versions.typescript || 'unknown'
  }
}
