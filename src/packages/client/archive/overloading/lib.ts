interface UserArgs {
  first?: number
  last?: number
  where?: UserWhere
}

interface UserWhere {
  id?: string
}

export interface Prisma {
  users: UsersFunction
}

export interface UsersFunction {
  (args?: { first?: number; last?: number; where?: UserWhere }): Promise<null>
  (args?: UserArgs): Promise<null>
}

export const prisma: Prisma = null as any
