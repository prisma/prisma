type Promotion = {
  text: string
  link: string
}

const promotions = [
  {
    text: `Tip: Need your database queries to be 1000x faster? Accelerate offers you that and more:`,
    link: 'https://pris.ly/tip-2-accelerate',
  },
  {
    text: `Tip: Interested in query caching in just a few lines of code? Try Accelerate today!`,
    link: 'https://pris.ly/tip-3-accelerate',
  },
  {
    text: `Tip: Want to turn off tips and other hints?`,
    link: 'https://pris.ly/tip-4-nohints',
  },
] satisfies Promotion[]

function renderPromotion(promotion: Promotion) {
  return `${promotion.text} ${promotion.link}`
}

function getRandomPromotion() {
  return promotions[Math.floor(Math.random() * promotions.length)]
}

export { getRandomPromotion, promotions, renderPromotion }
