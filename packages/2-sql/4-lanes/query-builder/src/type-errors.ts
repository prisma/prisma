import type { Brand } from '@internal/contract/types';

/**
 * An error message type, prefixed with `[error]`.
 *
 * @template TMessage The error message.
 */
export type ErrorMessage = `[error] ${string}`;

/**
 * An error type indicating that the previous function call had bad input.
 * To be used as a return type.
 *
 * @template TMessage The error message.
 */
export type PreviousFunctionReceivedBadInputError<TMessage extends ErrorMessage> = Brand<TMessage>;
