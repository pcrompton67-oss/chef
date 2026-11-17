import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Cormorant_Garamond, Jost } from 'next/font/google'
import { content } from '@/lib/content'
import './globals.css'

// Elegant high-contrast serif for headings, like the "E" in Eleanor's logo.
const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
})

// Light, clean sans-serif for body text, like the lettering on her printed menu.
const jost = Jost({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-body',
  display: 'swap',
})

const site = content.en.site

export const metadata: Metadata = {
  title: { default: site.title, template: `%s · ${site.name}` },
  description: site.description,
  icons: { icon: '/CEJ_Logo.jpg', apple: '/CEJ_Logo.jpg' },
  openGraph: {
    title: site.title,
    description: site.description,
    images: [{ url: '/CEJ_Logo.jpg', width: 1080, height: 1080 }],
  },
  alternates: { languages: { en: '/', fr: '/fr' } },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#f7f3ea',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${jost.variable} ${cormorant.variable} bg-background`}
      suppressHydrationWarning
    >
      <head>
        {/* Lets the fade-in hide content only when JavaScript is running. */}
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.classList.add('js')",
          }}
        />
      </head>
      <body className="font-sans antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
