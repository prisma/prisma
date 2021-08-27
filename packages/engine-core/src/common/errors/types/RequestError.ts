export interface RequestError {
  error: string
  user_facing_error: {
    is_panic: boolean
    message: string
    meta?: object
    error_code?: string
  }
}
