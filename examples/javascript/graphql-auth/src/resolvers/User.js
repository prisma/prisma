const User = {
  posts: ({ id }, args, context) => {
    return context.prisma.user({ id }).posts()
  },
}

module.exports = {
  User,
}
