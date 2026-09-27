import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { escapeHtml, sendEmail } from "@/lib/email";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = getDb();
  const weekAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
  const subscriptions = await db.alertSubscription.findMany({
    where: { enabled: true, verifiedAt: { not: null }, OR: [{ lastSentAt: null }, { lastSentAt: { lt: weekAgo } }] },
    take: 200,
  });
  const end = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const events = await db.event.findMany({
    where: { isPublished: true, isMock: false, startAt: { gte: new Date(), lte: end } },
    include: { company: true }, orderBy: { startAt: "asc" }, take: 250,
  });
  const base = process.env.APP_URL ?? new URL(request.url).origin;
  let sent = 0;
  const errors: string[] = [];
  for (const subscription of subscriptions) {
    const companies = subscription.companyNames.map((value) => value.toLowerCase());
    const matches = events.filter((event) => {
      const categoryMatch = !subscription.categories.length || event.careerCategories.some((category) => subscription.categories.includes(category));
      const typeMatch = !subscription.eventTypes.length || subscription.eventTypes.includes(event.type);
      const company = event.company?.name.toLowerCase() ?? "";
      const companyMatch = !companies.length || companies.some((value) => company.includes(value));
      return categoryMatch && typeMatch && companyMatch;
    }).slice(0, 20);
    if (!matches.length) continue;
    const rows = matches.map((event) => `<li><a href="${base}/events/${encodeURIComponent(event.slug)}">${escapeHtml(event.title)}</a> — ${event.startAt.toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} ET</li>`).join("");
    const unsubscribe = `${base}/api/alerts/unsubscribe?token=${subscription.unsubscribeToken}`;
    try {
      await sendEmail(subscription.email, `${matches.length} Cornell recruiting events for you`, `<h2>Your RecruitDrop weekly radar</h2><ul>${rows}</ul><p><a href="${base}">Open RecruitDrop</a> · <a href="${unsubscribe}">Unsubscribe</a></p>`);
      await db.alertSubscription.update({ where: { id: subscription.id }, data: { lastSentAt: new Date() } });
      sent++;
    } catch (error) {
      errors.push(`${subscription.id}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
  return NextResponse.json({ subscriptions: subscriptions.length, sent, errors });
}
