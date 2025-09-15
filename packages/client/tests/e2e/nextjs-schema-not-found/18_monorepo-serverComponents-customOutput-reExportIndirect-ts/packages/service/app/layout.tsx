export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
      </head>
      <body>{children}</body>
    </html>
  )
}
