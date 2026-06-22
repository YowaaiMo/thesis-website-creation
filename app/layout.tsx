import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { Navigation } from '@/components/navigation'
import { SimulationProvider } from '@/lib/simulation-context'
import { LShapedProvider } from '@/lib/lshaped-context'
import Script from 'next/script'
import Image from 'next/image'
import './globals.css'

export const metadata: Metadata = {
  title: 'MC & LHS - Planification Energetique Algerie 2050',
  description: 'Plateforme interactive de generation de scenarios stochastiques (Monte Carlo et Latin Hypercube Sampling) pour la planification energetique de l\'Algerie',
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
    <html lang="fr" suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <Script id="theme-init" strategy="beforeInteractive">{`(function(){var t=localStorage.getItem('theme');document.documentElement.classList.toggle('dark',t!=='light');})();`}</Script>
        <SimulationProvider>
        <LShapedProvider>
          <div className="flex min-h-screen bg-background">
            <Navigation />
            <main className="flex-1 ml-64 p-8">
              <div className="fixed top-4 right-6 z-50">
                <Image src="/placeholder-logo.png" alt="Logo" width={48} height={48} className="object-contain" />
              </div>
              {children}
            </main>
          </div>
        </LShapedProvider>
        </SimulationProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
