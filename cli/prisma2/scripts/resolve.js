#!/usr/bin/env node

const resolvePkg = require('resolve-pkg')
console.log(resolvePkg(process.argv[2], { cwd: __dirname }))
