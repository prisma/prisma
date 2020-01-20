import { Command, format } from '@prisma/cli'
import chalk from 'chalk'

export class Dev implements Command {
  static new(): Dev {
    return new Dev()
  }
  private constructor() {}
  async parse(argv: string[]) {
    return format(`
      ${chalk.redBright('Prisma CLI does not include a \`dev\` command any more right now.')}

      If you want to run Prisma Studio, use ${chalk.green('prisma2 studio')}.
      If you want to generate the Prisma Client, use ${chalk.green('prisma2 generate')} (or ${chalk.green('prisma2 generate --watch')})
      If you want to update your schema, use ${chalk.green('prisma2 introspect')}.
      If you want to migrate your database, use ${chalk.green('prisma2 migrate')}.
    `)
  }
}
