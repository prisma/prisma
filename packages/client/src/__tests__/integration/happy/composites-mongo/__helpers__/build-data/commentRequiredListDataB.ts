export function commentRequiredListDataB(id: string) {
  return {
    id: id,
    country: 'France',
    contents: {
      set: [
        {
          text: 'Goodbye World',
          upvotes: {
            vote: false,
            userId: '11',
          },
        },
        {
          text: 'Hello World',
          upvotes: {
            vote: true,
            userId: '10',
          },
        },
      ],
    },
  }
}
