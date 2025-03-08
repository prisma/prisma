// @ts-check
let preinstall
try {
  preinstall = require('../preinstall/index.js')
} catch (_e) {
  //
}
if (preinstall) {
  preinstall.main()
}
