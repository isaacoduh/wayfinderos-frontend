import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Lora } from 'next/font/google'
import { TooltipProvider } from '@/components/ui/tooltip'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-sans-family' })
const lora = Lora({ subsets: ['latin'], variable: '--font-serif-family' })

export const metadata: Metadata = {
  title: { default: 'Wayfinder OS', template: '%s · Wayfinder OS' },
  description: 'A durable, agentic workspace for planning remarkable trips.',
  generator: 'v0.app',
}

export const viewport: Viewport = { colorScheme: 'light', themeColor: '#f7f4ee', width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={`bg-background ${geist.variable} ${lora.variable}`}><body className="antialiased"><TooltipProvider>{children}</TooltipProvider>{process.env.NODE_ENV === 'production' && <Analytics />}</body></html>
}
