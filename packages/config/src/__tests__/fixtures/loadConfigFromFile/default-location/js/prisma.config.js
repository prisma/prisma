const { defineConfig } = require('src/index')

module.exports = defineConfig({
  datasource: {
    url: 'postgresql://DATABASE_URL',
  },
})
