export class PrismaConfigEnvError extends Error {
  constructor(name: string) {
    super(`Missing required environment variable: ${name}`)
    this.name = 'PrismaConfigEnvError'
  }
}

export function env(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new PrismaConfigEnvError(name)
  }
  return value
}
