import { DatabaseType } from 'prisma-datamodel'
import { PromptElement, RadioElement } from '../prompt-lib/types'
import { DatabaseCredentials, SchemaWithMetadata } from '../types'

export const dbTypeToDbPort: Record<DatabaseType, string> = {
  postgres: '5432',
  mysql: '3306',
  sqlite: '3306',
  mongo: '27017',
}

const dbTypeToDefaultConnectionString: Record<DatabaseType, string> = {
  postgres: `postgresql://localhost:${dbTypeToDbPort[DatabaseType.postgres]}`,
  mysql: `mysql://localhost:${dbTypeToDbPort[DatabaseType.mysql]}`,
  sqlite: `sqlite://localhost:${dbTypeToDbPort[DatabaseType.sqlite]}`,
  mongo: `mongo://localhost:${dbTypeToDbPort[DatabaseType.mongo]}`,
}

export const INPUT_DATABASE_CREDENTIALS_ELEMENTS = (dbType: DatabaseType): PromptElement<DatabaseCredentials>[] => [
  {
    type: 'text-input',
    identifier: 'host',
    label: 'Host:',
    placeholder: 'localhost',
  },
  {
    type: 'text-input',
    identifier: 'port',
    label: 'Port:',
    placeholder: dbTypeToDbPort[dbType],
  },
  {
    type: 'text-input',
    identifier: 'user',
    label: 'User:',
  },
  {
    type: 'text-input',
    identifier: 'password',
    label: 'Password:',
    style: { marginBottom: dbType === 'mysql' ? 1 : 0 },
  },
  ...(dbType !== 'mysql'
    ? {
        type: 'text-input',
        identifier: 'database',
        label: 'Database:',
        style: { marginBottom: 1 },
      }
    : ({} as any)),
  {
    type: 'checkbox',
    label: 'Enable SSL ?',
    identifier: 'ssl',
    style: { marginBottom: 1 },
  },
  { type: 'separator', style: { marginBottom: 1 } },
  {
    type: 'text-input',
    identifier: 'uri',
    label: 'Or URL',
    placeholder: dbTypeToDefaultConnectionString[dbType],
    style: { marginBottom: 1 },
  },
  { type: 'separator', style: { marginBottom: 1 } },
  {
    type: 'select',
    label: 'Connect',
    value: '__CONNECT__',
  },
]

export const SELECT_DATABASE_TYPE_ELEMENTS: PromptElement[] = [
  {
    type: 'select',
    label: 'SQLite',
    value: 'sqlite',
    description: "Beginner's choice",
  },
  {
    type: 'select',
    label: 'MySQL',
    value: 'mysql',
    description: 'MySQL compliant databases like MySQL or MariaDB',
  },
  {
    type: 'select',
    label: 'Postgres',
    value: 'postgres',
    description: 'PostgreSQL database',
  },
  // {
  //   type: 'select',
  //   label: 'MongoDB',
  //   value: 'mongodb',
  //   description: 'Mongo Database',
  // },
]

export const SELECT_DATABASE_SCHEMAS_ELEMENTS = (schemas: SchemaWithMetadata[]): PromptElement[] => [
  ...schemas.map(
    schema =>
      ({
        type: 'radio',
        label: schema.name,
        value: schema.name,
        identifier: 'schema',
        description: `${schema.metadata.countOfTables} tables, ${schema.metadata.sizeInBytes / 1000} KB`,
      } as RadioElement),
  ),
  {
    type: 'text-input',
    identifier: 'newSchema',
    label: 'New schema',
    placeholder: 'Or enter a name for a new schema',
    style: { marginTop: 1 },
  },
  { type: 'separator', style: { marginTop: 1, marginBottom: 1, marginLeft: 1 } },
  { type: 'select', label: 'Introspect', description: '(Please select a schema)', style: { marginTop: 1 } },
]

export const SELECT_TOOL_ELEMENTS: PromptElement[] = [
  {
    type: 'checkbox',
    label: 'Photon',
    identifier: 'photon',
  },
  {
    type: 'checkbox',
    label: 'Lift',
    identifier: 'lift',
  },
  {
    type: 'separator',
    style: { marginTop: 1, marginBottom: 1, marginLeft: 1 },
  },
  {
    type: 'select',
    label: 'Create',
    value: '__CREATE__',
  },
]

export const SELECT_LANGUAGE_ELEMENTS: PromptElement[] = [
  {
    type: 'select',
    label: 'TypeScript',
    value: 'TypeScript',
  },
  {
    type: 'select',
    label: 'JavaScript',
    value: 'JavaScript',
  },
  {
    type: 'separator',
    style: { marginTop: 1, marginBottom: 1, marginLeft: 1 },
  },
]

export const SELECT_TEMPLATE_ELEMENTS: PromptElement[] = [
  {
    type: 'select',
    label: 'From Scratch',
    value: 'from_scratch',
    description: 'Basic Prisma setup + simple script',
  },
  {
    type: 'select',
    label: 'GraphQL boilerplate',
    value: 'graphql_boilerplate',
    description: 'GraphQL server example',
  },
  {
    type: 'select',
    label: 'REST boilerplate',
    value: 'rest_boilerplate',
    description: 'REST API example (using express.js)',
  },
  {
    type: 'select',
    label: 'gRPC boilerplate',
    value: 'grpc_boilerplate',
    description: 'gRPC API example (client + server)',
  },
  {
    type: 'separator',
    style: { marginTop: 1, marginBottom: 1, marginLeft: 1 },
  },
]
