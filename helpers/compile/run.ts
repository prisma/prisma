import execa from 'execa'

// wrapper around execa to run our build cmds

export function run(command: string) {
  return execa.command(command, {
    preferLocal: true,
    shell: true,
    stdio: 'inherit',
  })
}
