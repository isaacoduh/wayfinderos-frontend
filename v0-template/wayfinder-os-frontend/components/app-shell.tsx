'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell, ChevronDown, CircleUserRound, Compass, CreditCard, Menu, Plus, Search, Settings, SlidersHorizontal, Sparkles, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

const nav = [
  { href: '/trips', label: 'Trips', icon: Compass },
  { href: '/profile', label: 'Travel profile', icon: SlidersHorizontal },
  { href: '/billing', label: 'Billing', icon: CreditCard },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const [open, setOpen] = useState(false)
  return <div className="min-h-screen bg-background text-foreground">
    <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r bg-sidebar lg:flex">
      <Link href="/trips" className="flex h-16 items-center gap-3 border-b px-5">
        <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground"><Compass className="size-4" /></span>
        <span className="font-serif text-lg font-semibold tracking-tight">Wayfinder</span>
        <span className="rounded-sm border px-1.5 py-0.5 text-[9px] font-bold tracking-widest text-muted-foreground">OS</span>
      </Link>
      <div className="p-3"><Button className="w-full justify-start" size="sm"><Plus data-icon="inline-start" />New trip</Button></div>
      <nav className="flex flex-col gap-1 px-3" aria-label="Primary navigation">
        {nav.map(({href,label,icon:Icon}) => <Link key={href} href={href} className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${path.startsWith(href) ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'}`}><Icon className="size-4" />{label}</Link>)}
      </nav>
      <div className="mt-auto flex flex-col gap-4 border-t p-4">
        <div className="flex flex-col gap-2"><div className="flex items-center justify-between text-xs"><span className="font-medium">Monthly credits</span><span className="tabular-nums text-muted-foreground">68 / 100</span></div><Progress value={68} /><p className="text-[11px] text-muted-foreground">Resets August 1</p></div>
        <button className="flex items-center gap-3 text-left"><span className="flex size-8 items-center justify-center rounded-full bg-secondary text-xs font-bold">AM</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">Avery Morgan</span><span className="block text-xs text-muted-foreground">Pro plan</span></span><ChevronDown className="size-4 text-muted-foreground" /></button>
      </div>
    </aside>
    <div className="lg:pl-60">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur md:px-6">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(!open)} aria-label="Toggle navigation">{open ? <X /> : <Menu />}</Button>
        <div className="relative hidden max-w-md flex-1 md:block"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input className="h-9 w-full rounded-md border bg-secondary/40 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Search trips, places, and notes…" /></div>
        <div className="ml-auto flex items-center gap-2"><span className="hidden items-center gap-1.5 rounded-md bg-secondary px-2.5 py-1.5 text-xs font-semibold sm:flex"><Sparkles className="size-3.5 text-accent-foreground" />68 credits</span><Button variant="ghost" size="icon" aria-label="Notifications"><Bell /></Button><Button variant="ghost" size="icon" aria-label="Account"><CircleUserRound /></Button></div>
      </header>
      {open && <nav className="fixed inset-x-0 top-16 z-20 flex flex-col gap-1 border-b bg-background p-3 shadow-lg lg:hidden">{nav.map(({href,label,icon:Icon}) => <Link onClick={() => setOpen(false)} key={href} href={href} className="flex items-center gap-3 rounded-md px-3 py-3 text-sm"><Icon className="size-4" />{label}</Link>)}</nav>}
      <main>{children}</main>
    </div>
  </div>
}
