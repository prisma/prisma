export function filterObject(obj, cb) {
  if (!obj || typeof obj !== 'object' || typeof obj.hasOwnProperty !== 'function') {
    return obj
  }
  const newObj = {}
  for (const key in obj) {
    const value = obj[key]
    if (Object.hasOwnProperty.call(obj, key) && cb(key, value)) {
      newObj[key] = value
    }
  }
  return newObj
}
