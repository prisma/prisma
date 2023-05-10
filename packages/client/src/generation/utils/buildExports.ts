export function buildExports(esm?: boolean) {
  if (esm === true) {
    return `const PrismaClient = getPrismaClient(config)
export { Prisma, PrismaClient }`
  } else {
    return `const PrismaClient = getPrismaClient(config)
Object.defineProperty(exports, "__esModule", { value: true })
Object.assign(exports, { Prisma, PrismaClient })`
  }
}
