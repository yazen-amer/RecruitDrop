export function getSiteUrl() {
  const value = process.env.APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? "https://" + process.env.VERCEL_PROJECT_PRODUCTION_URL : undefined);
  if (!value) return undefined;
  const url = new URL(value);
  if (!["https:", "http:"].includes(url.protocol)) throw new Error("APP_URL must use HTTP(S)");
  return url.origin;
}
