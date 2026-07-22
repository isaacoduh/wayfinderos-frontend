# Wayfinder OS Case Study

Status: `v1.0.1 demo polish`

Wayfinder OS is an agentic travel planning workspace that turns messy trip conversations into structured itineraries, places, checklists, budgets, and shareable trip pages.

## Problem

Travel planning usually starts as unstructured conversation: dates, preferences, budget concerns, restaurant ideas, booking constraints, and half-decided plans. Standard chat interfaces can help brainstorm, but they often leave users with a long transcript instead of a working trip artifact.

The product problem was to preserve the flexibility of conversation while turning useful planning output into durable, editable product state.

## Product Thesis

The useful unit of travel planning is not a chat response. It is a trip workspace.

Wayfinder OS treats the assistant as a way to shape structured artifacts: itinerary days, places, checklist items, budget notes, and a public share page. The workspace gives users a place to review, correct, lock, regenerate, and share the plan instead of repeatedly prompting from scratch.

## Core User Flow

1. Open the landing page.
2. Sign in with Clerk.
3. Create or open a private trip.
4. Add trip context through chat.
5. Run Build My Trip.
6. Review itinerary, places, checklist, and budget artifacts.
7. Mark booked or locked itinerary items.
8. Regenerate a weak day while preserving protected items.
9. Publish a read-only public share page.
10. Open the public share link.

## Architecture Decisions

The project uses a split frontend/backend architecture:

- Next.js owns the product UI, Clerk route protection, streaming chat consumption, and worker polling.
- FastAPI owns API routing, backend auth verification, persistence, LLM calls, and public share payload shaping.
- PostgreSQL stores durable trip state.
- Redis/RQ handles async Build My Trip and regenerate-day jobs.
- Clerk provides real user identity instead of a demo-only account model.

This separation keeps the frontend focused on product ergonomics while making the backend responsible for trust boundaries, state transitions, and long-running work.

## Agentic Workflow Design

The agent design favors structured outputs over free-form completion.

Trip-aware chat can respond conversationally while using current trip context. Build My Trip and regenerate-day workflows ask the model for structured planning output that is validated before being persisted.

The main workflows are:

- Trip chat: streams assistant text and records the conversation.
- Build My Trip: turns trip context into itinerary days, places, checklist items, budget estimates, assumptions, and warnings.
- Regenerate day: targets one itinerary day and preserves locked or booked items.

The important product choice is that the model does not directly become the source of truth. Its output is parsed, validated, and merged into application models.

## Async Job Design

Build My Trip and regenerate-day can take long enough that they should not behave like ordinary request/response actions. The backend creates an `AgentRun`, stores lifecycle events, enqueues work in Redis/RQ, and lets the frontend poll for run status and refreshed workspace data.

This gives the UI enough structure to show progress, recover from slow jobs, and preserve a record of what happened during a workflow.

## Auth And Privacy Model

Clerk handles user sign-in. The backend verifies Clerk session tokens and maps the Clerk subject to local users. Trips are queried by authenticated user ownership.

Public share pages are intentionally separate from private workspaces. A share page is read-only and exposes the public trip packet, not the private chat transcript or internal user account data.

For local-only development, `AUTH_DEV_BYPASS=true` can re-enable a seeded shared beta user. That mode should stay disabled outside local development.

## UI And Product Evolution

The UI evolved from a basic planning prototype into a product-shaped workspace:

- Public landing page for context.
- Private dashboard for saved trips.
- Dense workspace layout for itinerary review, chat, places, budget, tasks, and activity.
- Mobile tabs for constrained screens.
- Clear workflow controls for Build My Trip, regenerate day, lock/book item, and publish share.

The final polish pass keeps the UI stable and focuses on making the project understandable as a demo artifact.

## Tradeoffs

- RQ is simpler than a larger workflow system and fits the demo scope, but it is not a full orchestration platform.
- The app stores generated planning artifacts directly in relational models plus JSON context, which keeps iteration fast but would need more formal versioning in a larger product.
- Public share pages are read-only, which keeps privacy and scope manageable.
- The LLM workflow is useful for structured drafts, but output quality still depends on prompt quality and available trip context.

## Intentionally Deferred

- Billing, credits, and subscriptions.
- Collaboration and roles.
- Google Places/place enrichment.
- Booking checkout for flights, hotels, restaurants, or activities.
- PDF export.
- Native mobile app.
- Advanced account/profile management.
- Full observability stack beyond structured logs and persisted agent events.

## What I Learned

The strongest version of an agentic product is usually not "chat plus magic." It is a normal product surface with explicit state, review points, user controls, and clear boundaries around what the model is allowed to change.

For this project, the most important design move was making the assistant produce durable artifacts that the user can inspect and edit. The second was separating fast conversational feedback from slower structured jobs.

## What I Would Do Next

If the product continued, the next work would be:

- Add place enrichment and maps.
- Add collaborative sharing with roles.
- Add version history for generated plans.
- Add stronger evaluation fixtures for agent output.
- Add billing only after usage and value are clearer.
