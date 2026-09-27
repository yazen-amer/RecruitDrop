import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";

const schema = z.object({
  eventId: z.string().min(1).max(64),
  deviceId: z.string().uuid(),
  reason: z.enum(["NOT_RECRUITING", "WRONG_CATEGORY", "EXPIRED", "DUPLICATE", "BAD_LINK"]),
  note: z.string().trim().max(300).optional(),
});

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "Feedback is unavailable." }, { status: 503 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid feedback." }, { status: 400 });
  await getDb().eventFeedback.upsert({
    where: { eventId_deviceId: { eventId: parsed.data.eventId, deviceId: parsed.data.deviceId } },
    create: parsed.data,
    update: { reason: parsed.data.reason, note: parsed.data.note },
  });
  return NextResponse.json({ ok: true });
}
