import type { DotenvConfigOutput } from 'dotenv'

/**
 * Modified version of https://github.com/motdotla/dotenv-expand
 * Our version does only expand ${ENV} - curly braces but not without curly braces
 *
 * Original License from https://github.com/motdotla/dotenv-expand/blob/de9e5cb0215495452f475f5be4dea1580b8217cd/LICENSE
 * Copyright (c) 2016, Scott Motte
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * * Redistributions of source code must retain the above copyright notice, this
 *  list of conditions and the following disclaimer.
 *
 * * Redistributions in binary form must reproduce the above copyright notice,
 *  this list of conditions and the following disclaimer in the documentation
 *  and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

export function dotenvExpand(config: DotenvConfigOutput & { ignoreProcessEnv?: boolean }) {
  // if ignoring process.env, use a blank object
  const environment = config.ignoreProcessEnv ? {} : process.env

  const interpolate = (envValue: string) => {
    const matches = envValue.match(/(.?\${(?:[a-zA-Z0-9_]+)?})/g)

    return (
      matches?.reduce(function (newEnv, match) {
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
          value = Object.hasOwnProperty.call(environment, key) ? environment[key] : config.parsed![key] || ''

          // Resolve recursive interpolations
          value = interpolate(value)
        }

        return newEnv.replace(replacePart, value)
      }, envValue) ?? envValue
    )
  }

  for (const configKey in config.parsed) {
    const value = Object.hasOwnProperty.call(environment, configKey) ? environment[configKey] : config.parsed[configKey]

    config.parsed[configKey] = interpolate(value!)
  }

  for (const processKey in config.parsed) {
    environment[processKey] = config.parsed[processKey]
  }

  return config
}
