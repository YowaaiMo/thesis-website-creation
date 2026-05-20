import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Navigation } from '@/components/navigation'
import { SimulationProvider } from '@/lib/simulation-context'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'Monte Carlo - Planification Energetique Algerie 2050',
  description: 'Plateforme interactive de generation de scenarios Monte Carlo pour la planification energetique stochastique de l\'Algerie',
  generator: 'v0.app',
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/apple-icon', sizes: '180x180', type: 'image/png' }],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr" className="bg-background">
      <body className="font-sans antialiased">
        <SimulationProvider>
          <div className="flex min-h-screen">
            <Navigation />
            <main className="flex-1 ml-64 p-8">
              {children}
            </main>
          </div>
        </SimulationProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
