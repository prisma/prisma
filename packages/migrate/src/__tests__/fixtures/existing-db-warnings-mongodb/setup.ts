import mongo from 'mongoose'

const postSchema = new mongo.Schema({
  title: String,
})

export async function setup(conn: mongo.Connection) {
  const Post = conn.model('Post', postSchema)
  await Post.create({ title: 'post-1' })
  await Post.create({ title: 'post-2' })
}

export async function inspect(conn: mongo.Connection) {
  const Post = conn.model('Post', postSchema)

  const posts = await Post.find({})
  return posts
}
