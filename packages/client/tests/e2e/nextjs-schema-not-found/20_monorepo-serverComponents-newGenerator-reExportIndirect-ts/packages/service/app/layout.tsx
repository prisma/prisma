type Props = {
  children: React.ReactNode
}

export default function RootLayout({ children }: Props) {
  return (
    <html>
      <head />
      <body>{children}</body>
    </html>
  )
}
