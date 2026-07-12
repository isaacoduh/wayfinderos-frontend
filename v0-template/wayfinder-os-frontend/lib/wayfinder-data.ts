export const trips = [
  { id: 'tokyo-spring', city: 'Tokyo', country: 'Japan', dates: 'Apr 18–27, 2027', status: 'Planning', progress: 72, budget: '$4,820', places: 28, collaborators: 2, next: 'Book Shinkansen seats', tone: 'blue' },
  { id: 'lisbon-week', city: 'Lisbon', country: 'Portugal', dates: 'Sep 05–12, 2026', status: 'Ready', progress: 94, budget: '$2,340', places: 19, collaborators: 1, next: 'Share final itinerary', tone: 'green' },
  { id: 'patagonia', city: 'Patagonia', country: 'Chile', dates: 'Nov 08–20, 2026', status: 'Draft', progress: 31, budget: '$6,100', places: 11, collaborators: 3, next: 'Compare flight routes', tone: 'amber' },
]

export const days = [
  { day: 1, date: 'Sat, Apr 18', area: 'Arrival · Shibuya', note: 'Easy pace after a long flight', items: [
    { time: '15:30', title: 'Arrive at Haneda', meta: 'Terminal 3 · 35 min transfer', type: 'Transit', booked: true },
    { time: '17:00', title: 'Check in at Trunk Hotel', meta: 'Cat Street · Confirmation saved', type: 'Stay', booked: true },
    { time: '19:30', title: 'Dinner at Uobei Shibuya', meta: '$ · 8 min walk · No booking', type: 'Food', booked: false },
  ]},
  { day: 2, date: 'Sun, Apr 19', area: 'Meiji · Harajuku', note: 'Architecture, gardens, and design', items: [
    { time: '08:30', title: 'Meiji Jingu morning walk', meta: 'Quietest before 10 · 75 min', type: 'Place', booked: false },
    { time: '11:00', title: 'Nezu Museum & garden', meta: '$12 · Timed entry recommended', type: 'Culture', booked: false },
    { time: '14:30', title: 'Koffee Mameya', meta: '$$ · Omotesando · 25 min', type: 'Food', booked: false },
  ]},
  { day: 3, date: 'Mon, Apr 20', area: 'Tsukiji · Ginza', note: 'Early start, polished afternoon', items: [
    { time: '07:15', title: 'Tsukiji outer market', meta: '$$ · Breakfast crawl · 2 hrs', type: 'Food', booked: false },
    { time: '11:30', title: 'Hamarikyu Gardens', meta: '$3 · Tea house stop', type: 'Place', booked: false },
    { time: '18:30', title: 'Sushi Ishiyama', meta: '$$$$ · Deposit paid', type: 'Food', booked: true },
  ]},
  { day: 4, date: 'Tue, Apr 21', area: 'Yanaka · Ueno', note: 'Old Tokyo and local craft', items: [
    { time: '09:00', title: 'Yanaka neighborhood walk', meta: 'Self-guided · 90 min', type: 'Place', booked: false },
    { time: '12:15', title: 'Kayaba Coffee', meta: '$$ · Historic kissaten', type: 'Food', booked: false },
    { time: '15:00', title: 'Tokyo National Museum', meta: '$7 · Gallery highlights', type: 'Culture', booked: false },
  ]},
]

export const placePins = [
  { n: 1, name: 'Meiji Jingu', kind: 'Culture', detail: 'Ancient forest shrine', x: 28, y: 55 },
  { n: 2, name: 'Nezu Museum', kind: 'Museum', detail: 'Art and garden', x: 49, y: 39 },
  { n: 3, name: 'Tsukiji Market', kind: 'Food', detail: 'Morning market crawl', x: 72, y: 69 },
  { n: 4, name: 'Yanaka Ginza', kind: 'Walk', detail: 'Old Tokyo streets', x: 66, y: 20 },
]

export const activities = [
  { title: 'Itinerary Optimizer completed', detail: 'Reduced transit by 48 minutes across days 2–4.', time: '12 min ago', status: 'complete' },
  { title: 'Restaurant Scout needs review', detail: 'Found 6 dinner options matching your budget.', time: 'Yesterday', status: 'review' },
  { title: 'Booking Monitor is watching', detail: 'Sushi Ishiyama reservation window opens Feb 18.', time: '2 days ago', status: 'active' },
]
