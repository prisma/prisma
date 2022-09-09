import type { Command } from '@prisma/internals'
import { format } from '@prisma/internals'
import chalk from 'chalk'

export class Dev implements Command {
  static new(): Dev {
    return new Dev()
  }

  // eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-unused-vars
  async parse(argv: string[]): Promise<string> {
    return format(`
      ${chalk.redBright('Prisma CLI does not include a `dev` command any more right now.')}

      If you want to run Prisma Studio, use ${chalk.green('prisma studio')}.
      If you want to generate the Prisma Client, use ${chalk.green('prisma generate')} (or ${chalk.green(
      'prisma generate --watch',
    )})
      If you want to update your schema, use ${chalk.green('prisma db pull')}.
      If you want to migrate your database, use ${chalk.green('prisma migrate')}.
    `)
  }
}
