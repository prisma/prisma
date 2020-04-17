import fetch from 'cross-fetch'

export type Fetcher = (input: {
  query: string
  typeName?: string
}) => Promise<{ data?: any; error?: any; errors?: any }>

interface EngineConfig {
  url?: string
  fetcher?: Fetcher
}

export class BrowserEngine {
  fetcher: Fetcher
  url?: string
  constructor({ fetcher }: EngineConfig) {
    this.fetcher = fetcher || this.defaultFetcher
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async start(): Promise<void> {}

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async stop(): Promise<void> {}

  defaultFetcher = async ({
    query,
    typeName, // eslint-disable-line @typescript-eslint/no-unused-vars
  }: {
    query: string
    typeName?: string
  }): Promise<any> => {
    return fetch(this.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables: {}, operationName: '' }),
    })
      .then((response) => {
        if (!response.ok) {
          return response.text().then((body) => {
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
      .catch((errors) => {
        return this.handleErrors({ errors, query })
      })
  }

  async request<T>(query: string, typeName?: string): Promise<T> {
    return this.fetcher({ query, typeName }).then((result) => {
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

  handleErrors({
    errors,
    query, // eslint-disable-line @typescript-eslint/no-unused-vars
  }: {
    errors?: any
    query: string
  }): void {
    const stringified = errors ? JSON.stringify(errors, null, 2) : null
    const message =
      stringified.length > 0
        ? stringified
        : `Error in prisma.\$\{rootField || 'query'}` // eslint-disable-line no-useless-escape
    throw new Error(message)
  }
}
