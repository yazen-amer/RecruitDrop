import { afterEach, describe, expect, it, vi } from "vitest";
import { getSiteUrl } from "./site-url";

afterEach(() => vi.unstubAllEnvs());
describe("public site origin", () => {
  it("prefers the explicit URL and strips paths", () => {
    vi.stubEnv("APP_URL", "https://recruitdrop.example/path");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "other.example");
    expect(getSiteUrl()).toBe("https://recruitdrop.example");
  });
  it("uses the production deployment hostname without guessing a preview URL", () => {
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "recruitdrop.example");
    expect(getSiteUrl()).toBe("https://recruitdrop.example");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    expect(getSiteUrl()).toBeUndefined();
  });
  it("rejects non-web origins", () => {
    vi.stubEnv("APP_URL", "file:///tmp/app");
    expect(() => getSiteUrl()).toThrow("HTTP(S)");
  });
});
