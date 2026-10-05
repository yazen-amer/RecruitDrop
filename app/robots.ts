import { getSiteUrl } from "@/lib/site-url";
import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/saved"] }, ...(getSiteUrl() ? { sitemap: new URL("/sitemap.xml", getSiteUrl()!).href } : {}) };
}
