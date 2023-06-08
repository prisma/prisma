import type { Command } from '@prisma/internals'
import { format } from '@prisma/internals'
import { green, red } from 'kleur/colors'

export class Dev implements Command {
  static new(): Dev {
    return new Dev()
  }

  // eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-unused-vars
  async parse(argv: string[]): Promise<string> {
    return format(`
      ${red('Prisma CLI does not include a `dev` command any more right now.')}

      If you want to run Prisma Studio, use ${green('prisma studio')}.
      If you want to generate the Prisma Client, use ${green('prisma generate')} (or ${green(
      'prisma generate --watch',
    )})
      If you want to update your schema, use ${green('prisma db pull')}.
      If you want to migrate your database, use ${green('prisma migrate')}.
    `)
  }
}
