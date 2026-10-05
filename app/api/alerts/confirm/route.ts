import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  let confirmed = false;
  if (process.env.DATABASE_URL && token) {
    const result = await getDb().alertSubscription.updateMany({ where: { verificationToken: token }, data: { verifiedAt: new Date(), enabled: true } });
    confirmed = result.count > 0;
  }
  return NextResponse.redirect(new URL(confirmed ? "/alerts?confirmed=1" : "/alerts?invalid=1", url.origin));
}
