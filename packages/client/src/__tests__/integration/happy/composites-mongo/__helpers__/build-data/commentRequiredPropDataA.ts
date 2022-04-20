export function commentRequiredPropDataA(id: string) {
  return {
    id: id,
    content: {
      set: {
        text: 'Hello World',
        upvotes: {
          vote: true,
          userId: '10',
        },
      },
    },
  }
}
