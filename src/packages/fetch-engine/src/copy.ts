import * as fs from 'fs'

export function copy(src, target) {
  return new Promise((resolve, reject) => {
    fs.copyFile(src, target, err => {
      if (err) {
        reject(err)
      } else {
        resolve()
      }
    })
  })
}
