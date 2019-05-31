const identity = str => str

const browserChalk: any = new Proxy(identity, {
  get: (obj, prop) => {
    return browserChalk
  },
  apply: (target, that, args) => {
    return target(args[0])
  },
})

export default browserChalk
