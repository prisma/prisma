import { Prisma, Role } from '@prisma/client'

export default {
  fetch() {
    const data = {
      Role,
      ModelName: Prisma.ModelName,
    }

    return new Response(JSON.stringify(data))
  },
}
