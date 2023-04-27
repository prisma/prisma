import { link } from '@prisma/internals'
import { bold, yellow } from 'kleur/colors'

export const breakingChangesMessage = `${yellow(bold('warn'))} Prisma 2.12.0 has breaking changes.
You can update your code with
${bold('`npx @prisma/codemods update-2.12 ./`')}
Read more at ${link('https://pris.ly/2.12')}`
