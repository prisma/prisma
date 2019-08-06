const User = {
  posts: ({ id }, args, context) => {
    return context.photon.users
      .findOne({
        where: {
          id,
        },
      })
      .posts()
  },
}

module.exports = {
  User,
}
