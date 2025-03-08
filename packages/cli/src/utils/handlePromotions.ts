type Promotion = {
  text: string
  link: string
}

const promotions = [
  {
    text: 'Tip: Want real-time updates to your database without manual polling? Discover how with Pulse:',
    link: 'https://pris.ly/tip-0-pulse',
  },
  {
    text: 'Tip: Want to react to database changes in your app as they happen? Discover how with Pulse:',
    link: 'https://pris.ly/tip-1-pulse',
  },
  {
    text: 'Tip: Need your database queries to be 1000x faster? Accelerate offers you that and more:',
    link: 'https://pris.ly/tip-2-accelerate',
  },
  {
    text: 'Tip: Interested in query caching in just a few lines of code? Try Accelerate today!',
    link: 'https://pris.ly/tip-3-accelerate',
  },
  {
    text: 'Tip: Easily identify and fix slow SQL queries in your app. Optimize helps you enhance your visibility:',
    link: 'https://pris.ly/--optimize',
  },
  {
    text: 'Tip: Curious about the SQL queries Prisma ORM generates? Optimize helps you enhance your visibility:',
    link: 'https://pris.ly/tip-2-optimize',
  },
  {
    text: 'Tip: Want to turn off tips and other hints?',
    link: 'https://pris.ly/tip-4-nohints',
  },
  {
    text: 'Help us improve the Prisma ORM for everyone. Share your feedback in a short 2-min survey:',
    link: 'https://pris.ly/orm/survey/release-5-22',
  },
] satisfies Promotion[]

function renderPromotion(promotion: Promotion) {
  return `${promotion.text} ${promotion.link}`
}

function getRandomPromotion() {
  return promotions[Math.floor(Math.random() * promotions.length)]
}

export { getRandomPromotion, promotions, renderPromotion }
