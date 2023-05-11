import { TSClientOptions } from '../TSClient/TSClient'

export function buildExports({ esm }: TSClientOptions) {
  if (esm === true) {
    return `console.log('Loaded @prisma/client in ES Module format')
export { Prisma, PrismaClient }`
  } else {
    return `console.log('Loaded @prisma/client in CommonJS format')
Object.defineProperty(exports, "__esModule", { value: true })
exports.PrismaClient = PrismaClient
exports.Prisma = Prisma`
  }
}
