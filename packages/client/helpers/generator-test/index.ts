import path from 'path'
import Generator from 'yeoman-generator'

import { Providers } from '../../tests/functional/_utils/providers'

const allProviders = Object.values(Providers)
export default class TestGenerator extends Generator {
  private testName = ''
  private providers: string[] = []
  private optOutReason = ''

  constructor(args: string | string[], opts: Generator.GeneratorOptions) {
    super(args, opts)
  }

  async prompting() {
    const { testName, providers } = await this.prompt([
      {
        type: 'input',
        name: 'testName',
        message: 'Name of the new test',
        validate: (input) => input.trim().length > 0,
      },
      {
        type: 'checkbox',
        name: 'providers',
        message: 'Which providers do you want to use?',
        choices: allProviders,
        default: allProviders,
        validate: (input) => input.length > 0,
      },
    ])

    this.testName = testName
    this.providers = providers

    const optedOutProviders = this.getOptedOutProviders()

    if (optedOutProviders.length > 0) {
      const { optOutReason } = await this.prompt([
        {
          type: 'input',
          name: 'optOutReason',
          message: `Reason for opting out of ${optedOutProviders.join(', ')}`,
          validate: (input) => input.trim().length > 0,
        },
      ])
      this.optOutReason = optOutReason
    }
  }

  writing() {
    const baseDir = this.destinationPath(path.join('tests', 'functional', this.testName))
    const templateArgs = {
      testName: this.testName,
      providers: this.providers,
      optedOutProviders: this.getOptedOutProviders(),
      optOutReason: this.optOutReason,
    }

    this.fs.copyTpl(this.templatePath('tests.ts.tpl'), path.join(baseDir, 'tests.ts'), templateArgs)
    this.fs.copyTpl(this.templatePath('_schema.ts.tpl'), path.join(baseDir, 'prisma/_schema.ts'), templateArgs)
    this.fs.copyTpl(this.templatePath('_matrix.ts.tpl'), path.join(baseDir, '_matrix.ts'), templateArgs)
  }

  private getOptedOutProviders(): string[] {
    return allProviders.filter((provider) => !this.providers.includes(provider))
  }
}
