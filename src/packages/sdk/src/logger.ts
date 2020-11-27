import chalk from "chalk";

export const tags = {
  error: chalk.red('error'),
  warn: chalk.yellow('warn'),
  info: chalk.blue('info'),
  log: 'log'
}

export function log(value: string) {
  console.log(`${tags.log} ${value}`);
}
export function warn(value: string) {
  console.log(`${tags.warn} ${value}`);
}
export function info(value: string) {
  console.error(`${tags.info} ${value}`);
}
export function error(value: string) {
  console.error(`${tags.error} ${value}`);
}