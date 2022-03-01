export function commentOptionalPropDataB(id: string) {
  return {
    id: id,
    country: 'France',
    content: {
      text: 'Goodbye World',
      upvotes: [
        {
          vote: false,
          userId: '11',
        },
        {
          vote: true,
          userId: '12',
        },
      ],
    },
  }
}
