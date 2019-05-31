export function encode(xs: any) {
  function bytes(s) {
    if (typeof s === 'string') {
      return s.split('').map(ord)
    } else if (Array.isArray(s)) {
      return s.reduce(function(acc, c) {
        return acc.concat(bytes(c))
      }, [])
    }
  }

  return Buffer.from([0x1b].concat(bytes(xs)))
}

var ord = (encode.ord = function ord(c) {
  return c.charCodeAt(0)
})
