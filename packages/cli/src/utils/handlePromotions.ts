const promotions = [
  {
    text: `Tip: Want real-time updates to your database without manual polling? Discover how with Pulse:`,
    link: '',
  },
  {
    text: `Tip: Want to react to database changes in your app as they happen? Discover how with Pulse:`,
    link: '',
  },
  {
    text: `Tip: Need your database queries to be 1000x faster? Accelerate offers you that and more:`,
    link: '',
  },
  {
    text: `Tip: Interested in query caching in just a few lines of code? Try Accelerate today!`,
    link: '',
  },
  {
    text: `Tip: Easily identify and fix slow SQL queries in your app. Optimize helps you enhance your visibility:`,
    link: 'https://pris.ly/--optimize',
  },
  {
    text: `Tip: Curious about the SQL queries Prisma ORM generates? Optimize helps you enhance your visibility:`,
    link: 'https://pris.ly/--optimize',
  },
]

const getRandomPromotion = () => {
  return promotions[Math.floor(Math.random() * promotions.length)]
}

export { getRandomPromotion, promotions }
