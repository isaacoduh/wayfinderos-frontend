'use client'

import { LocateFixed, Minus, Plus } from 'lucide-react'
import { useState } from 'react'
import { placePins } from '@/lib/wayfinder-data'
import { Button } from '@/components/ui/button'

export function TripMap() {
 const [selected,setSelected]=useState(1)
 const place=placePins.find(p=>p.n===selected)!
 return <div className="relative h-full min-h-[360px] overflow-hidden bg-map">
  <div className="absolute inset-0 map-grid opacity-70" />
  <svg aria-hidden="true" className="absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M12 86 C 18 62, 30 66, 28 55 S 42 48,49 39 S 61 27,66 20 S 65 50,72 69" fill="none" stroke="var(--primary)" strokeWidth="1.3" strokeDasharray="2 1.3"/><path d="M0 25H100M0 48H100M0 76H100M18 0V100M42 0V100M77 0V100" stroke="var(--border)" strokeWidth=".35" /></svg>
  {placePins.map(p=><button key={p.n} onClick={()=>setSelected(p.n)} aria-label={`Select ${p.name}`} style={{left:`${p.x}%`,top:`${p.y}%`}} className={`absolute flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-card text-xs font-bold shadow-md ${selected===p.n?'bg-primary text-primary-foreground':'bg-card text-foreground'}`}>{p.n}</button>)}
  <div className="absolute right-3 top-3 flex flex-col gap-1"><Button size="icon" variant="secondary"><Plus /></Button><Button size="icon" variant="secondary"><Minus /></Button><Button size="icon" variant="secondary"><LocateFixed /></Button></div>
  <div className="absolute inset-x-3 bottom-3 rounded-md border bg-card/95 p-3 shadow-lg backdrop-blur"><div className="flex justify-between"><div><span className="text-[10px] font-bold uppercase tracking-wider text-primary">Stop {place.n} · {place.kind}</span><p className="font-serif text-lg font-semibold">{place.name}</p><p className="text-xs text-muted-foreground">{place.detail}</p></div><Button variant="outline" size="sm">Details</Button></div></div>
 </div>
}
