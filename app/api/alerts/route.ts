import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { sendEmail } from "@/lib/email";

const schema = z.object({
  email: z.string().email().max(254),
  categories: z.array(z.string().max(40)).max(12),
  eventTypes: z.array(z.string().max(40)).max(10),
  companyNames: z.array(z.string().trim().min(1).max(80)).max(20),
});

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL)
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Check your email and preferences." }, { status: 400 });
  if (!process.env.RESEND_API_KEY || !process.env.ALERT_FROM_EMAIL)
    return NextResponse.json({ error: "Email alerts are not configured yet." }, { status: 503 });
  const email = parsed.data.email.toLowerCase();
  const verificationToken = randomBytes(24).toString("hex");
  const unsubscribeToken = randomBytes(24).toString("hex");
  await getDb().alertSubscription.upsert({
    where: { email },
    create: { ...parsed.data, email, verificationToken, unsubscribeToken },
    update: { ...parsed.data, verificationToken, enabled: true, verifiedAt: null },
  });
  const base = process.env.APP_URL ?? new URL(request.url).origin;
  const confirm = `${base}/api/alerts/confirm?token=${verificationToken}`;
  await sendEmail(email, "Confirm your RecruitDrop alerts", `<p>Confirm your Cornell recruiting alerts:</p><p><a href="${confirm}">Confirm alerts</a></p><p>If you did not request this, ignore this email.</p>`);
  return NextResponse.json({ ok: true, message: `Confirmation sent to ${email}.` });
}
