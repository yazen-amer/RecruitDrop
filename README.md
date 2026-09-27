# Cornell Recruiting Radar

A production-oriented MVP that brings public recruiting events, info sessions, tech talks, coffee chats, interviews, career fairs, and application deadlines into one Cornell-focused feed.

## Architecture

The app uses Next.js App Router and TypeScript for the UI and API routes, PostgreSQL with Prisma for relational data, Zod for validation, and a provider-neutral ingestion service. Official Cornell Localist JSON and page-level JSON-LD are parsed directly; Gemini structured output is used only when a public page has no usable structured data. Fetching, extraction, normalization, deduplication, and persistence remain separate.

```text
public URL → safe fetch → listing/detail discovery → direct structured parsing
                                              ↘ Gemini fallback
           → Zod validation → normalization → fuzzy dedupe → PostgreSQL
```

`Source` records configure pages independently. The seed synchronizes a compact registry of official Cornell Career Network, Cornell Events API, career-fair, ILR, and graduate-career pages. The Career Network adapter walks six upcoming monthly archives, follows bounded pagination and event pages in small batches, and extracts the common Cornell event format without spending an LLM request per page. Web sources can discover same-origin event-detail links; API, RSS, iCalendar, JSON, and plain-text responses are accepted without pretending every page has the same shape. Every ingestion attempt creates an `IngestionRun`, and `EventSource` preserves the exact listing or detail URL for a merged event. Submitted URLs enter a moderation-ready queue and are not automatically published. Saves use device-local storage in the public demo; the relational `User` and `SavedEvent` models are ready for account-backed persistence.

The repository contains realistic seed records marked `isMock=true`. The UI calls them **Sample data** so development content cannot be mistaken for live ingestion.

## Project map

```text
app/                  Pages and API endpoints
components/           Reusable interface components
lib/ingestion/        Fetch, extract, validate, and deduplicate events
lib/db.ts             Shared Prisma client
prisma/schema.prisma  PostgreSQL data model
prisma/migrations/    Database migrations
prisma/seed.ts        Development seed data
scripts/ingest.ts     Manual ingestion command
```

There is intentionally no UI framework or deployment-specific build layer. The interface uses React components, ordinary CSS, and native form controls.

## Local setup

1. Install Node 22+ and pnpm.
2. Copy `.env.example` to `.env` and provide a PostgreSQL connection string.
3. Run:

```bash
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open `http://localhost:3000`. Without `DATABASE_URL`, the feed still renders its clearly labeled sample dataset, but database-backed submission and ingestion endpoints return an explicit unavailable response.

### Personalized alerts

Set `APP_URL`, `RESEND_API_KEY`, and `ALERT_FROM_EMAIL` to enable double-opt-in weekly email alerts. `ALERT_FROM_EMAIL` must use a domain verified with Resend. The `/api/cron/alerts` endpoint is protected by the same `CRON_SECRET` as ingestion; `vercel.json` calls it every Monday. Alert preferences support multiple career areas and event types plus followed company names. Every message includes a one-click unsubscribe link.

## Ingestion

`pnpm db:seed` synchronizes the vetted source registry. Run every enabled source manually:

```bash
pnpm ingest
```

Or run only one source with `pnpm ingest <source-id>`. A source's JSON `config` controls detail/listing-page limits, calendar months, included/excluded URL patterns, check interval, and whether high-confidence events from that trusted source may publish automatically. Fetching and extraction are bounded, batched, and delayed between batches to reduce load and API rate-limit spikes.

For deployment, `/api/cron/ingest` processes up to ten due sources. It requires `Authorization: Bearer $CRON_SECRET`. `vercel.json` schedules this every three hours on Vercel; an equivalent external scheduler can call the same endpoint on any host. A deployed server—not a laptop—owns the schedule.

The fetcher permits public HTTP(S) text pages, rejects obvious private-network targets, applies a timeout and response-size limit, and identifies itself with a user agent. Source owners remain responsible for checking robots directives and terms before enabling a source.

## Deduplication

The current scorer checks canonical registration URLs first, then compares normalized company names, a ±3 hour date window, and Jaccard title similarity. When a duplicate is found, missing fields can be enriched and another `EventSource` is attached. `lib/ingestion/dedupe.ts` is deliberately isolated so an embedding candidate-retrieval stage can be added later.

## Commands

```bash
pnpm test          # deduplication tests
pnpm build         # production build
pnpm db:generate   # generate Prisma client
pnpm db:migrate    # create/apply a local migration
pnpm db:seed       # insert labeled mock records
pnpm ingest        # ingest all enabled sources
pnpm ingest <id>   # ingest one source
```

## Production notes

- Use a PostgreSQL connection pool in production. Managed providers such as Neon, Supabase, and Railway all work with Prisma.
- Keep `GEMINI_API_KEY`, `DATABASE_URL`, and `CRON_SECRET` server-side. The Gemini key is optional for sources that expose supported structured data.
- Add authentication before exposing source administration or moderation.
- Replace the small in-memory submission limiter with Redis or a gateway rate limit for multi-instance deployment.
- The next high-value product layer is opt-in alerts keyed by saved companies and career categories; the schema already preserves the necessary signals.
