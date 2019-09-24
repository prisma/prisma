import { ExampleApi } from '../types'
import { useFetch } from './useFetch'

export function useExampleApi(): null | ExampleApi {
  // augment the data with `id` and `language`, so that it can be used easier later
  return useFetch('https://raw.githubusercontent.com/prisma/prisma-examples/master/.github/api.json', results => {
    return {
      ...results,
      examples: {
        ...Object.entries(results.examples)
          .map(([language, languageExamples]: [any, any]) => [
            language,
            {
              ...Object.entries(languageExamples)
                .map(([id, example]: [any, any]) => [
                  id,
                  {
                    ...example,
                    language,
                    id,
                    path: `/${language}/${id}/`,
                  },
                ])
                .reduce(reduceKeyValue, {}),
            },
          ])
          .reduce(reduceKeyValue, {}),
      },
    }
  })
}

function reduceKeyValue(acc, [key, value]) {
  acc[key] = value
  return acc
}
