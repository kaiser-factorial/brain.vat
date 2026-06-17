import type { Metadata } from 'next'
import { JetBrains_Mono } from 'next/font/google'
import '../globals.css'

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: '--font-mono'
});

export const metadata: Metadata = {
  title: 'Component Showcase',
  description: 'Cyber Theme Component Showcase',
}

export default function ShowcaseLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
