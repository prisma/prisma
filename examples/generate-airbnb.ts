import { TSClient } from '../src/generation'
import * as fs from 'fs'
import { performance } from 'perf_hooks'
import { getDMMF } from '../src/utils/getDMMF'

const datamodel = `type User {
  id: ID! @id
  createdAt: DateTime! @createdAt
  updatedAt: DateTime! @updatedAt
  firstName: String!
  lastName: String!
  email: String! @unique
  password: String!
  phone: String!
  responseRate: Float
  responseTime: Int
  isSuperHost: Boolean! @default(value: false)
  ownedPlaces: [Place]
  location: Location @relation(link: TABLE)
  bookings: [Booking]
  paymentAccount: [PaymentAccount]
  sentMessages: [Message] @relation(name: "SentMessages")
  receivedMessages: [Message] @relation(name: "ReceivedMessages")
  notifications: [Notification]
  profilePicture: Picture @relation(link: TABLE)
  hostingExperiences: [Experience]
}

type Place {
  id: ID! @id
  name: String
  size: PLACE_SIZES
  shortDescription: String!
  description: String!
  slug: String!
  maxGuests: Int!
  numBedrooms: Int!
  numBeds: Int!
  numBaths: Int!
  reviews: [Review]
  amenities: Amenities! @relation(link: TABLE)
  host: User! @relation(link: TABLE)
  pricing: Pricing! @relation(link: TABLE)
  location: Location! @relation(link: TABLE)
  views: Views! @relation(link: TABLE)
  guestRequirements: GuestRequirements @relation(link: TABLE)
  policies: Policies @relation(link: TABLE)
  houseRules: HouseRules @relation(link: TABLE)
  bookings: [Booking]
  pictures: [Picture]
  popularity: Int!
  createdAt: DateTime! @createdAt
  updatedAt: DateTime! @updatedAt
}

type Pricing {
  id: ID! @id
  place: Place!
  monthlyDiscount: Int
  weeklyDiscount: Int
  perNight: Int!
  smartPricing: Boolean! @default(value: false)
  basePrice: Int!
  averageWeekly: Int!
  averageMonthly: Int!
  cleaningFee: Int
  securityDeposit: Int
  extraGuests: Int
  weekendPricing: Int
  currency: CURRENCY
  createdAt: DateTime! @createdAt
  updatedAt: DateTime! @updatedAt
}

type GuestRequirements {
  id: ID! @id
  govIssuedId: Boolean! @default(value: false)
  recommendationsFromOtherHosts: Boolean! @default(value: false)
  guestTripInformation: Boolean! @default(value: false)
  place: Place!
  createdAt: DateTime! @createdAt
  updatedAt: DateTime! @updatedAt
}

type Policies {
  id: ID! @id
  createdAt: DateTime! @createdAt
  updatedAt: DateTime! @updatedAt
  checkInStartTime: Float!
  checkInEndTime: Float!
  checkoutTime: Float!
  place: Place!
}

type HouseRules {
  id: ID! @id
  createdAt: DateTime! @createdAt
  updatedAt: DateTime! @updatedAt
  suitableForChildren: Boolean
  suitableForInfants: Boolean
  petsAllowed: Boolean
  smokingAllowed: Boolean
  partiesAndEventsAllowed: Boolean
  additionalRules: String
}

type Views {
  id: ID! @id
  lastWeek: Int!
  place: Place!
  createdAt: DateTime! @createdAt
  updatedAt: DateTime! @updatedAt
}

type Location {
  id: ID! @id
  lat: Float!
  lng: Float!
  neighbourHood: Neighbourhood @relation(link: TABLE)
  user: User
  place: Place
  address: String
  directions: String
  experience: Experience @relation(link: TABLE)
  restaurant: Restaurant @relation(link: TABLE)
  createdAt: DateTime! @createdAt
  updatedAt: DateTime! @updatedAt
}

type Neighbourhood {
  id: ID! @id
  locations: [Location]
  name: String!
  slug: String!
  homePreview: Picture @relation(link: TABLE)
  city: City! @relation(link: TABLE)
  featured: Boolean!
  popularity: Int!
  createdAt: DateTime! @createdAt
  updatedAt: DateTime! @updatedAt
}

type City {
  id: ID! @id
  name: String!
  neighbourhoods: [Neighbourhood]
  createdAt: DateTime! @createdAt
  updatedAt: DateTime! @updatedAt
}

type Picture {
  id: ID! @id
  url: String!
  createdAt: DateTime! @createdAt
  updatedAt: DateTime! @updatedAt
}

type Experience {
  id: ID! @id
  category: ExperienceCategory @relation(link: TABLE)
  title: String!
  host: User! @relation(link: TABLE)
  location: Location!
  pricePerPerson: Int!
  reviews: [Review]
  preview: Picture! @relation(link: TABLE)
  popularity: Int!
  createdAt: DateTime! @createdAt
  updatedAt: DateTime! @updatedAt
}

type ExperienceCategory {
  id: ID! @id
  mainColor: String! @default(value: "#123456")
  name: String!
  experience: Experience
  createdAt: DateTime! @createdAt
  updatedAt: DateTime! @updatedAt
}

type Amenities {
  id: ID! @id
  place: Place!
  elevator: Boolean! @default(value: false)
  petsAllowed: Boolean! @default(value: false)
  internet: Boolean! @default(value: false)
  kitchen: Boolean! @default(value: false)
  wirelessInternet: Boolean! @default(value: false)
  familyKidFriendly: Boolean! @default(value: false)
  freeParkingOnPremises: Boolean! @default(value: false)
  hotTub: Boolean! @default(value: false)
  pool: Boolean! @default(value: false)
  smokingAllowed: Boolean! @default(value: false)
  wheelchairAccessible: Boolean! @default(value: false)
  breakfast: Boolean! @default(value: false)
  cableTv: Boolean! @default(value: false)
  suitableForEvents: Boolean! @default(value: false)
  dryer: Boolean! @default(value: false)
  washer: Boolean! @default(value: false)
  indoorFireplace: Boolean! @default(value: false)
  tv: Boolean! @default(value: false)
  heating: Boolean! @default(value: false)
  hangers: Boolean! @default(value: false)
  iron: Boolean! @default(value: false)
  hairDryer: Boolean! @default(value: false)
  doorman: Boolean! @default(value: false)
  paidParkingOffPremises: Boolean! @default(value: false)
  freeParkingOnStreet: Boolean! @default(value: false)
  gym: Boolean! @default(value: false)
  airConditioning: Boolean! @default(value: false)
  shampoo: Boolean! @default(value: false)
  essentials: Boolean! @default(value: false)
  laptopFriendlyWorkspace: Boolean! @default(value: false)
  privateEntrance: Boolean! @default(value: false)
  buzzerWirelessIntercom: Boolean! @default(value: false)
  babyBath: Boolean! @default(value: false)
  babyMonitor: Boolean! @default(value: false)
  babysitterRecommendations: Boolean! @default(value: false)
  bathtub: Boolean! @default(value: false)
  changingTable: Boolean! @default(value: false)
  childrensBooksAndToys: Boolean! @default(value: false)
  childrensDinnerware: Boolean! @default(value: false)
  crib: Boolean! @default(value: false)
  createdAt: DateTime! @createdAt
  updatedAt: DateTime! @updatedAt
}

type Review {
  id: ID! @id
  createdAt: DateTime! @createdAt
  text: String!
  stars: Int!
  accuracy: Int!
  location: Int!
  checkIn: Int!
  value: Int!
  cleanliness: Int!
  communication: Int!
  place: Place! @relation(link: TABLE)
  experience: Experience @relation(link: TABLE)
  updatedAt: DateTime! @updatedAt
}

type Booking {
  id: ID! @id
  createdAt: DateTime! @createdAt
  bookee: User! @relation(link: TABLE)
  place: Place! @relation(link: TABLE)
  startDate: DateTime!
  endDate: DateTime!
  payment: Payment! @relation(link: TABLE)
  updatedAt: DateTime! @updatedAt
}

type Payment {
  id: ID! @id
  createdAt: DateTime! @createdAt
  serviceFee: Float!
  placePrice: Float!
  totalPrice: Float!
  booking: Booking!
  paymentMethod: PaymentAccount! @relation(link: TABLE)
  updatedAt: DateTime! @updatedAt
}

type PaymentAccount {
  id: ID! @id
  createdAt: DateTime! @createdAt
  type: PAYMENT_PROVIDER
  user: User! @relation(link: TABLE)
  payments: [Payment]
  paypal: PaypalInformation @relation(link: TABLE)
  creditcard: CreditCardInformation @relation(link: TABLE)
  updatedAt: DateTime! @updatedAt
}

type PaypalInformation {
  id: ID! @id
  createdAt: DateTime! @createdAt
  email: String!
  paymentAccount: PaymentAccount!
  updatedAt: DateTime! @updatedAt
}

type CreditCardInformation {
  id: ID! @id
  createdAt: DateTime! @createdAt
  cardNumber: String!
  expiresOnMonth: Int!
  expiresOnYear: Int!
  securityCode: String!
  firstName: String!
  lastName: String!
  postalCode: String!
  country: String!
  paymentAccount: PaymentAccount
  updatedAt: DateTime! @updatedAt
}

type Message {
  id: ID! @id
  createdAt: DateTime! @createdAt
  from: User! @relation(link: TABLE, name: "SentMessages")
  to: User! @relation(link: TABLE, name: "ReceivedMessages")
  deliveredAt: DateTime!
  readAt: DateTime!
  updatedAt: DateTime! @updatedAt
}

type Notification {
  id: ID! @id
  createdAt: DateTime! @createdAt
  type: NOTIFICATION_TYPE
  user: User! @relation(link: TABLE)
  link: String!
  readDate: DateTime!
  updatedAt: DateTime! @updatedAt
}

type Restaurant {
  id: ID! @id
  createdAt: DateTime! @createdAt
  title: String!
  avgPricePerPerson: Int!
  pictures: [Picture]
  location: Location!
  isCurated: Boolean! @default(value: true)
  slug: String!
  popularity: Int!
  updatedAt: DateTime! @updatedAt
}

enum CURRENCY {
  CAD
  CHF
  EUR
  JPY
  USD
  ZAR
}

enum PLACE_SIZES {
  ENTIRE_HOUSE
  ENTIRE_APARTMENT
  ENTIRE_EARTH_HOUSE
  ENTIRE_CABIN
  ENTIRE_VILLA
  ENTIRE_PLACE
  ENTIRE_BOAT
  PRIVATE_ROOM
}

enum PAYMENT_PROVIDER {
  PAYPAL
  CREDIT_CARD
}

enum NOTIFICATION_TYPE {
  OFFER
  INSTANT_BOOK
  RESPONSIVENESS
  NEW_AMENITIES
  HOUSE_RULES
}
`

const dmmf = getDMMF(datamodel)
fs.writeFileSync(__dirname + '/airbnb-dmmf.json', JSON.stringify(dmmf, null, 2))
const client = new TSClient(dmmf)

console.clear()
const before = performance.now()
const str = String(client)
const after = performance.now()
console.log(`Generated client in ${(after - before).toFixed(3)}ms`)
fs.writeFileSync(__dirname + '/generated-airbnb.ts', str)
