export const trustedSources = [
  {
    enabled: true,
    name: "Cornell Career Network Events",
    url: "https://career.cornell.edu/events/",
    kind: "WEB_PAGE" as const,
    config: {
      maxDetailPages: 120,
      maxListingPages: 48,
      includePathPatterns: ["/events/"],
      excludePathPatterns: ["/events/page/", "/events/?"],
      calendarMonthsAhead: 6,
      preferDetailPages: true,
      intervalHours: 24,
      autoPublishTrusted: true,
    },
  },
  {
    enabled: true,
    name: "Cornell Events - Public Recruiting Coverage",
    url: "https://events.cornell.edu/api/2/events?days=180&pp=100&distinct=true",
    kind: "API" as const,
    config: { intervalHours: 12, maxApiPages: 30, autoPublishTrusted: true },
  },
  {
    enabled: false,
    name: "Cornell Career Fair Days",
    url: "https://career.cornell.edu/cornell-career-fair-days/",
    kind: "WEB_PAGE" as const,
    config: { intervalHours: 12, autoPublishTrusted: true, disabledReason: "Official page returns 404; Career Network and Events API cover fairs" },
  },
  {
    enabled: false,
    name: "Cornell Graduate Careers Events",
    url: "https://gradcareers.cornell.edu/wp-json/tribe/events/v1/events?per_page=50",
    kind: "API" as const,
    config: { intervalHours: 12, maxApiPages: 5, autoPublishTrusted: true, disabledReason: "Robots policy returns a 403 bot challenge for RecruitDrop; requires owner approval" },
  },
] as const;
