export function buildExports(esm?: boolean) {
  if (esm === true) {
    return `const PrismaClient = getPrismaClient(config)
const exports = Object.assign({ PrismaClient, Prisma }, Prisma)
export { exports as default, Prisma, PrismaClient }`
  } else {
    return `const PrismaClient = getPrismaClient(config)
Object.defineProperty(exports, "__esModule", { value: true })
exports.PrismaClient = PrismaClient
exports.Prisma = Prisma
Object.assign(exports, Prisma)`
  }
}
