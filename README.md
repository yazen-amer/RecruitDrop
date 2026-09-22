# Cornell Recruiting Radar

A production-oriented MVP that brings public recruiting events, info sessions, tech talks, coffee chats, interviews, career fairs, and application deadlines into one Cornell-focused feed.

## Architecture

The app uses Next.js App Router and TypeScript for the UI and API routes, PostgreSQL with Prisma for relational data, Zod for input and structured extraction validation, and a provider-neutral ingestion service. The extraction adapter currently calls the OpenAI Responses API with a strict JSON Schema. Fetching, extraction, normalization, deduplication, and persistence are separate modules so any layer can be replaced independently.

```text
public URL → safe fetch → text reduction → structured LLM extraction
           → Zod validation → normalization → fuzzy dedupe → PostgreSQL
```

`Source` records configure pages independently. Every ingestion attempt creates an `IngestionRun`, and `EventSource` preserves all source references for a merged event. Submitted URLs enter a moderation-ready queue and are not automatically published. Saves use device-local storage in the public demo; the relational `User` and `SavedEvent` models are ready for account-backed persistence.

The repository contains realistic seed records marked `isMock=true`. The UI calls them **Sample data** so development content cannot be mistaken for live ingestion.

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

## Ingestion

Create a `Source` row with an allowed public URL, then run one source manually:

```bash
pnpm ingest <source-id>
```

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
pnpm ingest <id>   # manually ingest one source
```

## Production notes

- Use a serverless PostgreSQL provider with pooled connections. The included Neon adapter works in edge/serverless runtimes.
- Keep `OPENAI_API_KEY`, `DATABASE_URL`, and `CRON_SECRET` server-side.
- Add authentication before exposing source administration or moderation.
- Replace the small in-memory submission limiter with Redis or a gateway rate limit for multi-instance deployment.
- The next high-value product layer is opt-in alerts keyed by saved companies and career categories; the schema already preserves the necessary signals.
