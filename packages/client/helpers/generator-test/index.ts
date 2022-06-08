import path from 'path'
import Generator from 'yeoman-generator'

const allProviders = ['sqlite', 'postgresql', 'mysql', 'cockroachdb', 'mongodb']

export default class TestGenerator extends Generator {
  private testName = ''
  private providers: string[] = []
  constructor(args: string | string[], opts: Generator.GeneratorOptions) {
    super(args, opts)
  }

  async prompting() {
    const answers = await this.prompt([
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

    this.testName = answers.testName
    this.providers = answers.providers
  }

  writing() {
    const baseDir = this.destinationPath(path.join('tests', 'functional', this.testName))
    const templateArgs = { testName: this.testName, providers: this.providers }

    this.fs.copyTpl(this.templatePath('tests.ts.tpl'), path.join(baseDir, 'tests.ts'), templateArgs)
    this.fs.copyTpl(this.templatePath('_schema.ts.tpl'), path.join(baseDir, 'prisma/_schema.ts'), templateArgs)
    this.fs.copyTpl(this.templatePath('_matrix.ts.tpl'), path.join(baseDir, '_matrix.ts'), templateArgs)
  }
}
