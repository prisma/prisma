import { ExampleApi } from '../types'
import { useFetch } from '../components/useFetch'

export function useExampleApi(): null | ExampleApi {
  return useFetch('https://raw.githubusercontent.com/prisma/prisma-examples/prisma2/api.json')
}
