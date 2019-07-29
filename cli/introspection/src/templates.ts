import chalk from 'chalk'

type Language = 'javascript' | 'typescript'

export interface Template {
  name: string
  language: Language
  description: string
  repo: TemplateRepository
  postIntallMessage: string
}

export interface TemplateRepository {
  uri: string
  branch: string
  path: string
}

export const defaultTemplate: (language: Language) => Template = (language = 'typescript') => {
  return {
    name: 'from_scratch',
    language: language.toLowerCase() as Language,
    description: 'GraphQL starter with Prisma 2',
    repo: {
      uri: 'https://github.com/prisma/photonjs',
      branch: 'master',
      path: `/examples/${language.toLowerCase()}/script`,
    },
    postIntallMessage: `
  Your template has been successfully set up!
    
  Here are the next steps to get you started:
    1. Run ${chalk.yellow(`prisma2 lift save --name init`)} to create a migration.
    2. Run ${chalk.yellow(`prisma2 lift up`)} to apply the migration.
    3. Run ${chalk.yellow(`yarn seed`)} to seed the database.
    4. Run ${chalk.yellow(`yarn start`)} (Runs the default script)
    5. That's it !
    `,
  }
}

export const availableTemplates: Template[] = [
  {
    name: 'graphql_boilerplate',
    language: 'typescript',
    description: 'GraphQL starter with Prisma 2',
    repo: {
      uri: 'https://github.com/prisma/photonjs',
      branch: 'master',
      path: '/examples/typescript/graphql',
    },
    postIntallMessage: `
  Your template has been successfully set up!
    
  Here are the next steps to get you started:
    1. Run ${chalk.yellow(`prisma2 lift save --name init`)} to create a migration.
    2. Run ${chalk.yellow(`prisma2 lift up`)} to apply the migration.
    3. Run ${chalk.yellow(`yarn seed`)} to seed the database.
    4. Run ${chalk.yellow(`yarn start`)} (Starts the GraphQL server)
    5. That's it !
    `,
  },
  {
    name: 'rest_boilerplate',
    language: 'typescript',
    description: 'REST with express server starter with Prisma 2',
    repo: {
      uri: 'https://github.com/prisma/photonjs',
      branch: 'master',
      path: '/examples/typescript/rest-express',
    },
    postIntallMessage: `
Your template has been successfully set up!
  
Here are the next steps to get you started:
  1. Run ${chalk.yellow(`prisma2 lift save --name init`)} to create a migration.
  2. Run ${chalk.yellow(`prisma2 lift up`)} to apply the migration.
  3. Run ${chalk.yellow(`yarn seed`)} to seed the database.
  4. Run ${chalk.yellow(`yarn start`)} (Starts the REST with express server)
  5. That's it !
  `,
  },
  {
    name: 'grpc_boilerplate',
    language: 'typescript',
    description: 'REST with express server starter with Prisma 2',
    repo: {
      uri: 'https://github.com/prisma/photonjs',
      branch: 'master',
      path: '/examples/typescript/grpc',
    },
    postIntallMessage: `
Your template has been successfully set up!
  
Here are the next steps to get you started:
  1. Run ${chalk.yellow(`prisma2 lift save --name init`)} to create a migration.
  2. Run ${chalk.yellow(`prisma2 lift up`)} to apply the migration.
  3. Run ${chalk.yellow(`yarn seed`)} to seed the database.
  4. Run ${chalk.yellow(`yarn start`)} (Starts the gRPC server)
  5. That's it !
  `,
  },
  {
    name: 'graphql_boilerplate',
    language: 'javascript',
    description: 'GraphQL starter with Prisma 2',
    repo: {
      uri: 'https://github.com/prisma/photonjs',
      branch: 'master',
      path: '/examples/javascript/graphql',
    },
    postIntallMessage: `
  Your template has been successfully set up!
    
  Here are the next steps to get you started:
    1. Run ${chalk.yellow(`prisma2 lift save --name init`)} to create a migration.
    2. Run ${chalk.yellow(`prisma2 lift up`)} to apply the migration.
    3. Run ${chalk.yellow(`yarn seed`)} to seed the database.
    4. Run ${chalk.yellow(`yarn start`)} (Starts the GraphQL server)
    5. That's it !
    `,
  },
  {
    name: 'rest_boilerplate',
    language: 'javascript',
    description: 'REST with express server starter with Prisma 2',
    repo: {
      uri: 'https://github.com/prisma/photonjs',
      branch: 'master',
      path: '/examples/javascript/rest-express',
    },
    postIntallMessage: `
Your template has been successfully set up!
  
Here are the next steps to get you started:
  1. Run ${chalk.yellow(`prisma2 lift save --name init`)} to create a migration.
  2. Run ${chalk.yellow(`prisma2 lift up`)} to apply the migration.
  3. Run ${chalk.yellow(`yarn seed`)} to seed the database.
  4. Run ${chalk.yellow(`yarn start`)} (Starts the REST with express server)
  5. That's it !
  `,
  },
  {
    name: 'grpc_boilerplate',
    language: 'javascript',
    description: 'REST with express server starter with Prisma 2',
    repo: {
      uri: 'https://github.com/prisma/photonjs',
      branch: 'master',
      path: '/examples/javascript/grpc',
    },
    postIntallMessage: `
Your template has been successfully set up!
  
Here are the next steps to get you started:
  1. Run ${chalk.yellow(`prisma2 lift save --name init`)} to create a migration.
  2. Run ${chalk.yellow(`prisma2 lift up`)} to apply the migration.
  3. Run ${chalk.yellow(`yarn seed`)} to seed the database.
  4. Run ${chalk.yellow(`yarn start`)} (Starts the gRPC server)
  5. That's it !
  `,
  },
]

export const templatesNames = availableTemplates.map(t => `\`${t.name}\``).join(', ')

export function findTemplate(name, language) {
  const template = availableTemplates.find(
    template => template.name === name && template.language === language.toLowerCase(),
  )
  if (!template) {
    return defaultTemplate(language)
  }
  return template
}
