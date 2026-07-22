# Wayfinder OS Demo Script

Status: `v1.0.1 demo polish`

## Three-Minute Flow

Goal: show that Wayfinder OS turns travel conversation into durable, reviewable trip artifacts.

1. Open the landing page.
   - Say: "Wayfinder OS is an agentic travel planning workspace. The key idea is that the output is not just a chat transcript; it becomes itinerary, places, checklist, budget, and a share page."
2. Sign in.
   - Say: "This uses real Clerk auth. Trips are private to the signed-in user."
3. Open a prepared trip from the dashboard.
   - Say: "Each trip is its own workspace with saved state."
4. Show the itinerary, places, checklist, budget, and chat panels.
   - Say: "The assistant works against the current trip context instead of starting cold every time."
5. Click Build My Trip.
   - Say: "Long-running structured planning happens as an async worker job, so the UI can show progress and recover from slow requests."
6. Lock or mark one itinerary item as booked.
   - Say: "Users can protect decisions they have already made."
7. Regenerate one day.
   - Say: "Regeneration targets a day while preserving locked and booked items."
8. Publish the share page and open the public link.
   - Say: "The public page is read-only and does not expose private chat."

What not to dwell on:

- Do not spend time on billing; it is intentionally deferred.
- Do not position generated plans as booking-confirmed travel.
- Do not over-explain every sidebar panel.
- Do not debug prompt details live unless asked.

## Seven-Minute Flow

Goal: show product depth and engineering decisions without drifting into feature expansion.

1. Landing page.
   - Say: "This is frozen as a polished demo artifact at v1.0.1."
2. Sign in with Clerk.
   - Say: "The app uses real auth and backend token verification."
3. Dashboard.
   - Show private trips, readiness, budget, and share status.
   - Say: "The dashboard is a real user-owned workspace entry point."
4. Open a trip.
   - Show the itinerary first.
   - Say: "The itinerary is durable PostgreSQL state, not just generated text."
5. Use chat.
   - Ask a trip-specific planning question.
   - Say: "Chat uses saved trip context and recent messages."
6. Run Build My Trip.
   - Show progress/activity events.
   - Say: "The API creates an agent run and enqueues Redis/RQ work. The frontend polls the run and reloads artifacts when complete."
7. Review artifacts.
   - Show itinerary days, places, checklist, and budget.
   - Say: "The agent output is parsed, validated, and persisted into product models."
8. Lock and book items.
   - Mark a reservation booked or lock an important item.
   - Say: "This gives the user control over what the model should not rewrite."
9. Regenerate a day.
   - Give an instruction such as: "Make this day slower and reduce transit."
   - Say: "The regenerate workflow scopes the prompt to one day and preserves protected items."
10. Publish share page.
   - Copy/open the public link.
   - Say: "The public page exposes only the read-only trip packet."
11. Close with limitations.
   - Say: "This is a demo and case study. Billing, collaboration, booking checkout, native mobile, and place enrichment are intentionally deferred."

## Backup Path If Worker Is Slow

If Build My Trip or day regeneration is slow:

1. Explain that the work is intentionally asynchronous.
2. Show the activity panel and queued/running state.
3. Switch to an already populated trip.
4. Continue the demo using existing itinerary, places, checklist, and budget artifacts.
5. Return to the job result if it completes before the demo ends.

Say: "The worker can take longer depending on model latency. For demo reliability, I keep a prepared trip with generated artifacts."

## Demo Checklist

- Backend API is running.
- Redis is running.
- Worker is running.
- Frontend is running.
- Clerk keys are configured.
- OpenAI key is configured.
- A prepared trip exists.
- A public share page can be published or an existing share link is ready.
