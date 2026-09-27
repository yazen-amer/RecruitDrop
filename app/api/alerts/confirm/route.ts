import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  if (process.env.DATABASE_URL && token)
    await getDb().alertSubscription.updateMany({ where: { verificationToken: token }, data: { verifiedAt: new Date(), enabled: true } });
  return NextResponse.redirect(new URL("/alerts?confirmed=1", url.origin));
}
