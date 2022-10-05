import { actionOperationMap, Client } from '../../getPrismaClient'

type Args = {
  type: string
} & ResultArgs &
  ModelArgs &
  ClientArgs &
  QueryArgs

type ResultArgs = {
  result: {
    needs: {
      [K in string]: boolean | ResultArgs['result']['needs']
    }
    fields: {
      [K in string]: () => unknown | Promise<unknown>
    }
  }
}

type ModelArgs = {
  model: {
    [K in string]: () => unknown | Promise<unknown>
  }
}

type ClientArgs = {
  model: {
    [K in string]: () => unknown | Promise<unknown>
  }
}

type QueryArgs = {
  query: {
    [key in keyof typeof actionOperationMap]: () => unknown | Promise<unknown>
  } & {
    $nested: {
      create: {
        [K in string]: {} | null | undefined | QueryArgs['query']['$nested']['create']
      }
      update: {
        [K in string]: {} | null | undefined | QueryArgs['query']['$nested']['update']
      }
      upsert: {
        [K in string]: {} | null | undefined | QueryArgs['query']['$nested']['upsert']
      }
      where: {
        [K in string]: {} | null | undefined | QueryArgs['query']['$nested']['where']
      }
    }
  }
}

/**
 *
 * @param this
 */
export function $extends(this: Client, args: Args) {}

// the only accessible fields are the ones that exist
function getOwnKeys(client: Client) {
  return new Proxy(client, {})
  return [...Object.keys(client)]
}
