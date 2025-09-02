type Crypto = {
  randomUUID: () => string
}

async function getCrypto(): Promise<Crypto> {
  // TODO: always use `globalThis.crypto` when we drop Node.js 18 support
  return globalThis.crypto ?? (await import('node:crypto'))
}

export async function randomUUID(): Promise<string> {
  const crypto = await getCrypto()
  return crypto.randomUUID()
}
