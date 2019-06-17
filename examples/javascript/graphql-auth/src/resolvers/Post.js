const Post = {
  author: ({ id }, args, context) => {
    return context.photon.posts
      .findOne({
        where: {
          id,
        },
      })
      .author()
  },
}

module.exports = {
  Post,
}
