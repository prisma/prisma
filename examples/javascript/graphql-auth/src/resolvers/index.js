const { Query } = require('./Query')
const { Mutation } = require('./Mutation')
const { User } = require('./User')
const { Post } = require('./Post')

const resolvers = {
  Query,
  Mutation,
  User,
  Post,
}

module.exports = {
  resolvers,
}
