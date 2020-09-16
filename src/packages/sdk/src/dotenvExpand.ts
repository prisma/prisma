import { DotenvConfigOutput } from 'dotenv'

export function dotenvExpand(config: DotenvConfigOutput & { ignoreProcessEnv?: boolean }) {
  // if ignoring process.env, use a blank object
  const environment = config.ignoreProcessEnv ? {} : process.env

  const interpolate = (envValue: string) => {
    var matches = envValue.match(/(.?\${(?:[a-zA-Z0-9_]+)?})/g) || []

    return matches.reduce(function (newEnv, match) {
      const parts = /(.?)\${([a-zA-Z0-9_]+)?}/g.exec(match)
      if (!parts) {
        return newEnv
      }

      const prefix = parts[1]

      let value, replacePart

      if (prefix === '\\') {
        replacePart = parts[0]
        value = replacePart.replace('\\$', '$')
      } else {
        const key = parts[2]
        replacePart = parts[0].substring(prefix.length)
        // process.env value 'wins' over .env file's value
        value = environment.hasOwnProperty(key) ? environment[key] : (config.parsed![key] || '')

        // Resolve recursive interpolations
        value = interpolate(value)
      }

      return newEnv.replace(replacePart, value)
    }, envValue)
  }

  for (const configKey in config.parsed) {
    const value = environment.hasOwnProperty(configKey) ? environment[configKey] : config.parsed[configKey]

    config.parsed[configKey] = interpolate(value!)
  }

  for (var processKey in config.parsed) {
    environment[processKey] = config.parsed[processKey]
  }

  return config
}
