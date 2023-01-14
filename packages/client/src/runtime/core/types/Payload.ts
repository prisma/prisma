export type Payload = {
  scalars: {
    [ScalarName in string]: unknown
  }
  objects: {
    [ObjectName in string]: unknown
  }
}
