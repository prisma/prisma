import chalk from 'chalk'
import Progress from 'progress'

export function getBar(text): Progress {
  return new Progress(`> ${text} [:bar] :percent`, {
    stream: process.stdout,
    width: 20,
    complete: '=',
    incomplete: ' ',
    total: 100,
    head: '',
  })
}

export function info(text) {
  console.log(`> ${text}`)
}

export function warn(text) {
  console.log(chalk.red('> Warning!'), text)
}
