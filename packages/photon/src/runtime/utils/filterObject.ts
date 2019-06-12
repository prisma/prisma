export function filterObject(obj, cb) {
  if (!obj || typeof obj !== 'object') {
    return obj
  }
  const newObj = {}
  for (const key in obj) {
    const value = obj[key]
    if (obj.hasOwnProperty(key) && cb(key, value)) {
      newObj[key] = value
    }
  }
  return newObj
}
