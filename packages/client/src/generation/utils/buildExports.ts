import { TSClientOptions } from '../TSClient/TSClient'

export function buildExports({ esm }: TSClientOptions) {
  if (esm === true) {
    return `export { Prisma, PrismaClient }`
  } else {
    return `Object.defineProperty(exports, "__esModule", { value: true })
exports.PrismaClient = PrismaClient
exports.Prisma = Prisma`
  }
}
