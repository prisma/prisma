import { PhotonError } from './Engine'

interface EngineConfig {
  url?: string
  fetcher?: (query: string) => Promise<{ data?: any; error?: any; errors?: any }>
}

export class BrowserEngine {
  fetcher: (query: string) => Promise<{ data?: any; error?: any; errors?: any }>
  url?: string
  constructor({ fetcher }: EngineConfig) {
    this.fetcher = fetcher || this.defaultFetcher
  }
  async start() {}

  async stop() {}

  defaultFetcher = async (query: string) => {
    return fetch(this.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables: {}, operationName: '' }),
    })
      .then(response => {
        if (!response.ok) {
          return response.text().then(body => {
            const { status, statusText } = response
            this.handleErrors({
              errors: {
                status,
                statusText,
                body,
              },
              query,
            })
          })
        } else {
          return response.json()
        }
      })
      .catch(errors => {
        if (!(errors instanceof PhotonError)) {
          return this.handleErrors({ errors, query })
        } else {
          throw errors
        }
      })
  }

  async request<T>(query: string): Promise<T> {
    return this.fetcher(query).then(result => {
      const { data } = result
      const errors = result.error || result.errors
      if (errors) {
        return this.handleErrors({
          errors,
          query,
        })
      }
      return data
    })
  }

  handleErrors({ errors, query }: { errors?: any; query: string }) {
    const stringified = errors ? JSON.stringify(errors, null, 2) : null
    const message = stringified.length > 0 ? stringified : `Error in prisma.\$\{rootField || 'query'}`
    throw new PhotonError(message, query, errors)
  }
}
