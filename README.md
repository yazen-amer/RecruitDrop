# Cornell Recruiting Radar

A production-oriented MVP that brings public recruiting events, info sessions, tech talks, coffee chats, interviews, career fairs, and application deadlines into one Cornell-focused feed.

## Architecture

The app uses Next.js App Router and TypeScript for the UI and API routes, PostgreSQL with Prisma for relational data, Zod for validation, and a provider-neutral ingestion service. Official Cornell Localist JSON, the graduate calendar API, and page-level JSON-LD are parsed directly; Gemini structured output is used only when a public page has no usable structured data. Fetching, extraction, normalization, deduplication, and persistence remain separate.

```text
public URL → safe fetch → listing/detail discovery → direct structured parsing
                                              ↘ Gemini fallback
           → Zod validation → normalization → fuzzy dedupe → PostgreSQL
```

`Source` records configure pages independently. The seed synchronizes a compact registry with explicit enabled states and disabled reasons. Cornell Career Network and the public Cornell Events API are enabled. The API scans up to 30 pages of the next 180 days, then applies a recruiting/career relevance filter across majors. General seminars and partner-only meetings are excluded. Career-fair and graduate-calendar sources remain disabled after live checks found a 404 and a crawler bot challenge, respectively. Generic ILR, department, employer-program, and Handshake landing pages are retired. The Career Network adapter walks six upcoming monthly archives, follows bounded pagination and event pages in small batches, and extracts the common Cornell event format without spending an LLM request per page. Web sources can discover same-origin event-detail links; API, RSS, iCalendar, JSON, and plain-text responses are accepted without pretending every page has the same shape. Every ingestion attempt creates an `IngestionRun`, and `EventSource` preserves the exact listing or detail URL for a merged event. Submitted URLs enter a moderation-ready queue and are not automatically published. Saves use device-local storage in the public demo; the relational `User` and `SavedEvent` models are ready for account-backed persistence.

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

`pnpm db:seed` synchronizes the vetted source registry. For production, synchronize source configurations without inserting sample events:

```bash
pnpm db:seed --sources-only
```

This updates existing sources and disables retired configurations without deleting events or their source references. Run every enabled source manually:

```bash
pnpm ingest
```

Or run only one source with `pnpm ingest <source-id>`. A source's JSON `config` controls detail/listing-page limits, calendar months, included/excluded URL patterns, check interval, and whether high-confidence events from that trusted source may publish automatically. Fetching and extraction are bounded. Page requests have a 30-second timeout and retry timeouts once with robots pacing. Page fetches and event writes fail independently; run logs retain failed URLs and counts for discovered, created, updated, and failed items. Console summaries also count skipped events. Failed sources receive a 12-hour retry delay.

For deployment, `/api/cron/ingest` processes one due source per invocation and declares a 300-second execution budget, so robots-paced crawling does not queue multiple long runs in one request. It requires `Authorization: Bearer $CRON_SECRET`. `vercel.json` schedules this every three hours on Vercel; an equivalent external scheduler can call the same endpoint on any host. A deployed server—not a laptop—owns the schedule.

The fetcher checks robots.txt for each origin, honors allow/disallow patterns and crawl delays, fetches serially with at least one second between requests, and checks redirects before following them. Unavailable robots policies fail closed. It rejects obvious private-network targets and URL credentials, applies a timeout and response-size limit, and identifies itself as RecruitDrop. Source owners must also review site terms before enabling new sources. Authenticated Handshake pages are never fetched; public Cornell pages may retain an explicit Handshake registration link.

## Deduplication

The scorer compares dates within a three-hour window, rejects conflicting locations and known companies, and matches canonical registration URLs or normalized title similarity. Exact event-detail URLs can identify refreshed extraction; shared listing URLs never identify an event by themselves. Missing fields can be enriched and another EventSource is attached. Published canonical records are preferred over retained duplicate rows.

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

### Gemini extraction

Gemini requests use `responseJsonSchema` with JSON Schema null unions. Live schema probes found that the full event schema with `maxItems: 50` (and even 20) returned HTTP 400 on the configured model; the same schema without that bound succeeded. A control using the old nullable properties without maxItems also succeeded, identifying the array bound as the observed HTTP 400 trigger rather than assuming nullable was the only cause. The 50-event bound remains enforced by Zod after extraction. API keys are sent in a header and redacted from provider errors. The default model is `gemini-3.5-flash-lite`; override it with `EXTRACTION_MODEL` as needed. `gemini-2.5-flash-lite` returned 404 for the configured account during validation.

The graduate calendar API extractor is fixture-tested and uses explicit UTC timestamps and RSVP links. That source stays disabled until its owner permits RecruitDrop to retrieve its robots policy. RSS and ICS content can be fetched but currently have no dedicated extractor; no such sources are enabled.
