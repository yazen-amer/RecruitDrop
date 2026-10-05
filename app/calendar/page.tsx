import { CalendarSubscription } from "@/components/calendar-subscription";
import { filterParams, parseFeedFilters } from "@/lib/feed";
export default async function CalendarPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) if (typeof value === "string") params.set(key, value);
  const filters = parseFeedFilters(params);
  return <div className="form-page alerts-page"><p className="eyebrow">Your calendar radar</p><h1>Keep opportunities in your calendar.</h1><p className="page-intro">Subscribe to {filters.category === "All areas" ? "all career areas" : filters.category} using your selected filters. New matching events appear when your calendar refreshes. No account or email required.</p>{process.env.DATABASE_URL ? <CalendarSubscription query={filterParams(filters).toString()} /> : <p>Live calendar subscriptions are available once public sources are connected.</p>}</div>;
}
