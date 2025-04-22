// Note that edge runtimes like cloudflare workers and vercel edge do not support Miniflare and its dependencies.
// Hence we cannot expose the PrismaD1MigrationAwareAdapterFactory that can connect to shadow databases using Miniflare.
// Hence we only export a simple runtime driver adapter in this special edge runtime build that cannot be used in the CLI.
// If you need a CLI and migration aware driver adapter in such scenario use PrismaD1HTTP instead but note that it requires different config inputs!
// Also see https://github.com/prisma/prisma/issues/26881.
export { PrismaD1AdapterFactory as PrismaD1 } from './d1'
export { PrismaD1HTTPAdapterFactory as PrismaD1HTTP } from './d1-http'
