import { MigrationStep } from '../types'
import { green, blue, cyan, bgGreen, red } from 'kleur'
import { strongGreen, strongRed } from './customColors'
import cleur from './cleur'
import chalk from 'chalk'
import indent from 'indent-string'

export function printDatamodelSteps(steps: MigrationStep[]) {
  return `${cya('model Blog')} ${a('{')}
    ${g('id')}${c} ${v('Int')} ${cya('@primary')}
    ${g('name')}${c} ${v('String')}
    ${g('viewCount')}${c} ${v('Int')}
    ${g('posts')}${c} ${v('Post[]')}
    ${g('authors')}${c} ${v('Author[]')}
${a('}')}

${cya('model Author')} ${a('{')}
${cleur.redBright('    id: Int @primary ')}
${green(`    id: ${strongGreen('ID')}${green(' @primary ')}`)}
    ${g('name')}${c} ${v('String?')}
    ${g('authors')}${c} ${v('Blog[]')}
${a('}')}

${cya('model Post')} ${a('{')}
    ${g('id')}${c} ${v('Int')} ${cya('@primary')}
    ${g('title')}${c} ${v('String')}
${cleur.redBright('    text: String     ')}
    ${g('tags')}${c} ${v('String[]')}
    ${g('blog')}${c} ${v('Blog')}
${a('}')}
`
}

// const a = chalk.rgb(74, 151, 214)
// const a = chalk.rgb(49, 149, 224)
const a = chalk.rgb(107, 139, 140)
const g = chalk.rgb(195, 218, 219)
const v = chalk.rgb(127, 155, 155)
// const v = chalk.rgb(156, 183, 183)
const c = a(':')
const cya = chalk.rgb(24, 109, 178)
