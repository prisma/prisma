/**
 * Input that flows from the user into the Client.
 */
export type UserArgs = {
  [K in string]: UserArgsProp | UserArgsProp[]
}

type UserArgsProp = UserArgs | string | number | boolean | bigint | null | undefined
