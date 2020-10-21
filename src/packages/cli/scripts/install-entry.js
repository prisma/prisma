try {
  const preinstall = require('../download-build/index.js')
  preinstall.main().catch(() => {
    //
  })
} catch (e) {
  //
}
