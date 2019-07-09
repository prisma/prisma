import { Command } from '@prisma/cli'
const packageJson = require('../package.json')

export class Version implements Command {
  static new(): Version {
    return new Version()
  }
  private constructor() {}
  async parse(argv: string[]) {
    const version = (packageJson.prisma && packageJson.prisma.version) || 'latest'
    return `${packageJson.name}@${packageJson.version}, binary version: ${version}`
  }
}
