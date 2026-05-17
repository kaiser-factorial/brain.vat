import type { Metadata } from 'next'
import { JetBrains_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { AuthProvider } from '@/lib/auth-context'
import { BYOBProvider } from '@/lib/byob-context'
import { SystemStatusProvider } from '@/lib/system-status-context'
import { BYOBModal } from '@/components/byob-modal'
import { VoiceModeProvider } from '@/components/voice-mode-context'
import './globals.css'

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: '--font-mono'
});

export const metadata: Metadata = {
  title: 'brain.vat | MAUK ∩ ABACI',
  description: 'a conversation at the intersection of being and becoming',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/icon.svg',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${jetbrainsMono.variable} font-mono antialiased dark`}>
        <AuthProvider>
          <BYOBProvider>
          <VoiceModeProvider>
          <SystemStatusProvider>
            {children}
            <BYOBModal />
          </SystemStatusProvider>
          </VoiceModeProvider>
          </BYOBProvider>
        </AuthProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
