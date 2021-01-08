import { resolvePkg } from '@prisma/sdk'

console.log(resolvePkg(__dirname, '@prisma/client'))
