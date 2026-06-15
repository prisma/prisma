import type { CommandCompletion } from '@prisma/internals'

export * as Platform from './_'

export const platformCompletion: CommandCompletion = {
  name: 'platform',
  description: 'Manage Prisma Platform resources',
  subcommands: [
    {
      name: 'platform auth',
      description: 'Manage authentication',
      subcommands: [
        { name: 'platform auth login', description: 'Log in to Prisma Platform' },
        { name: 'platform auth logout', description: 'Log out from Prisma Platform' },
        { name: 'platform auth show', description: 'Show current authentication status' },
      ],
    },
    {
      name: 'platform workspace',
      description: 'Manage workspaces',
      subcommands: [{ name: 'platform workspace show', description: 'Show workspace information' }],
    },
    {
      name: 'platform environment',
      description: 'Manage environments',
      subcommands: [
        { name: 'platform environment create', description: 'Create a new environment' },
        { name: 'platform environment delete', description: 'Delete an environment' },
        { name: 'platform environment show', description: 'Show environment information' },
      ],
    },
    {
      name: 'platform project',
      description: 'Manage projects',
      subcommands: [
        { name: 'platform project create', description: 'Create a new project' },
        { name: 'platform project delete', description: 'Delete a project' },
        { name: 'platform project show', description: 'Show project information' },
      ],
    },
    {
      name: 'platform pulse',
      description: 'Manage Prisma Pulse',
      subcommands: [
        { name: 'platform pulse enable', description: 'Enable Prisma Pulse' },
        { name: 'platform pulse disable', description: 'Disable Prisma Pulse' },
      ],
    },
    {
      name: 'platform accelerate',
      description: 'Manage Prisma Accelerate',
      subcommands: [
        { name: 'platform accelerate enable', description: 'Enable Prisma Accelerate' },
        { name: 'platform accelerate disable', description: 'Disable Prisma Accelerate' },
      ],
    },
  ],
}
