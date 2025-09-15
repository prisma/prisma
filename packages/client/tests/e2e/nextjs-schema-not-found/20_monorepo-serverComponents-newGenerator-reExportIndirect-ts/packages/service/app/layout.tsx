type Props = {
  children: React.ReactNode
}

export default function RootLayout({ children }: Props) {
  return (
    <html>
      <head>
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
      </head>
      <body>{children}</body>
    </html>
  )
}
