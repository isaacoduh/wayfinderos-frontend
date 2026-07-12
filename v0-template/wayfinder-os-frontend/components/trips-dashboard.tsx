'use client'

import Link from 'next/link'
import { ArrowUpRight, Bot, CalendarDays, CheckCircle2, Clock3, MapPin, MoreHorizontal, Plus, Users } from 'lucide-react'
import { useState } from 'react'
import { trips, activities } from '@/lib/wayfinder-data'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

export function TripsDashboard() {
  const [filter, setFilter] = useState('All trips')
  const filters = ['All trips', 'Planning', 'Ready', 'Draft']
  const visible = filter === 'All trips' ? trips : trips.filter(t => t.status === filter)
  return <div className="mx-auto flex max-w-7xl flex-col gap-8 p-4 md:p-8 lg:p-10">
    <section className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">Trip control center</p><h1 className="font-serif text-3xl font-semibold tracking-tight md:text-4xl">Good morning, Avery.</h1><p className="mt-2 text-sm text-muted-foreground">Three journeys are taking shape. Tokyo needs your attention next.</p></div><Button><Plus data-icon="inline-start" />Plan a new trip</Button></section>
    <section className="grid border-y sm:grid-cols-2 xl:grid-cols-4">
      {[['Pro plan','3 active trips','Renews Aug 1'],['68 credits','32 used this cycle','68% remaining'],['7 agent runs','2 need review','This month'],['$13,260','Across active trips','On target']].map((s,i)=><div key={s[0]} className="flex flex-col gap-1 border-b p-5 sm:border-r xl:border-b-0"><span className="text-xs font-medium text-muted-foreground">{s[2]}</span><strong className="font-serif text-2xl font-semibold">{s[0]}</strong><span className="text-xs text-muted-foreground">{s[1]}</span>{i===1 && <Progress className="mt-2" value={68} />}</div>)}
    </section>
    <section className="flex flex-col gap-4"><div className="flex flex-col justify-between gap-3 md:flex-row md:items-center"><div><h2 className="font-serif text-2xl font-semibold">Your trips</h2><p className="text-sm text-muted-foreground">Plans, bookings, and agent work in one durable workspace.</p></div><div className="flex gap-1 rounded-md border bg-card p-1">{filters.map(f=><button key={f} onClick={()=>setFilter(f)} className={`rounded px-3 py-1.5 text-xs font-medium ${filter===f?'bg-primary text-primary-foreground':'text-muted-foreground hover:text-foreground'}`}>{f}</button>)}</div></div>
      <div className="overflow-hidden rounded-lg border bg-card">{visible.map((trip,index)=><Link href={`/trips/${trip.id}`} key={trip.id} className="group grid gap-5 border-b p-5 transition-colors last:border-b-0 hover:bg-secondary/40 md:grid-cols-[1.4fr_.8fr_.8fr_auto] md:items-center">
        <div className="flex items-start gap-4"><span className={`mt-1 flex size-10 shrink-0 items-center justify-center rounded-md ${trip.tone==='green'?'bg-success/15 text-success':trip.tone==='amber'?'bg-warning/15 text-warning-foreground':'bg-primary/10 text-primary'}`}><MapPin className="size-5" /></span><div><div className="flex items-center gap-2"><h3 className="font-serif text-xl font-semibold">{trip.city}</h3><Badge variant="secondary">{trip.status}</Badge></div><p className="text-sm text-muted-foreground">{trip.country} · {trip.dates}</p><p className="mt-2 text-xs font-medium">Next: <span className="text-muted-foreground">{trip.next}</span></p></div></div>
        <div><div className="mb-2 flex justify-between text-xs"><span>Trip readiness</span><span className="tabular-nums text-muted-foreground">{trip.progress}%</span></div><Progress value={trip.progress} /></div>
        <div className="grid grid-cols-3 gap-3 text-center md:text-left"><div><strong className="block text-sm">{trip.budget}</strong><span className="text-[11px] text-muted-foreground">Budget</span></div><div><strong className="block text-sm">{trip.places}</strong><span className="text-[11px] text-muted-foreground">Places</span></div><div><strong className="flex items-center justify-center gap-1 text-sm md:justify-start"><Users className="size-3" />{trip.collaborators}</strong><span className="text-[11px] text-muted-foreground">People</span></div></div>
        <ArrowUpRight className="hidden size-5 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 md:block" />
      </Link>)}</div>
    </section>
    <section className="grid gap-6 xl:grid-cols-[1fr_320px]"><div className="rounded-lg border bg-card"><div className="flex items-center justify-between border-b p-5"><div><h2 className="font-serif text-xl font-semibold">Agent activity</h2><p className="text-xs text-muted-foreground">Recent work across your trips</p></div><Button variant="ghost" size="sm">View all</Button></div><div>{activities.map(a=><div key={a.title} className="flex gap-4 border-b p-4 last:border-b-0"><span className="mt-0.5 flex size-8 items-center justify-center rounded-md bg-secondary">{a.status==='complete'?<CheckCircle2 className="size-4 text-success"/>:a.status==='review'?<Clock3 className="size-4 text-warning"/>:<Bot className="size-4 text-primary"/>}</span><div className="min-w-0 flex-1"><p className="text-sm font-medium">{a.title}</p><p className="text-xs leading-relaxed text-muted-foreground">{a.detail}</p></div><span className="whitespace-nowrap text-[11px] text-muted-foreground">{a.time}</span></div>)}</div></div><div className="flex flex-col justify-between gap-6 rounded-lg bg-primary p-6 text-primary-foreground"><div><Bot className="mb-5 size-6"/><p className="text-xs font-bold uppercase tracking-[0.16em] opacity-70">Suggested next</p><h3 className="mt-2 font-serif text-2xl font-semibold">Resolve your Tokyo booking gaps</h3><p className="mt-2 text-sm leading-relaxed opacity-75">Three time-sensitive reservations open within the next 14 days.</p></div><Button variant="secondary" asChild><Link href="/trips/tokyo-spring">Review with agent</Link></Button></div></section>
  </div>
}
