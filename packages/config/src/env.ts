export class PrismaConfigEnvError extends Error {
  constructor(name: string) {
    super(`Missing required environment variable: ${name}`)
    this.name = 'PrismaConfigEnvError'
  }
}

export function env<Env extends Record<string, string>>(name: keyof Env): string {
  const value = (process.env as Env)[name]
  if (!value) {
    throw new PrismaConfigEnvError(name as string)
  }
  return value
}
