export function buildExports(esm?: boolean) {
  if (esm === true) {
    return `export { Prisma, PrismaClient }`
  } else {
    return `Object.defineProperty(exports, "__esModule", { value: true })
Object.assign(exports, { Prisma, PrismaClient })`
  }
}
