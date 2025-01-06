async function getProcessObject() {
  try {
    // On deno 2.X `process` is directly globally available but not in deno 1.X!
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
