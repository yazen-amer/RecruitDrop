export const trustedSources = [
  {
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
  ...[
    ["Cornell Events — Career", "career"],
    ["Cornell Events — Recruiting", "recruiting"],
    ["Cornell Events — Employer", "employer"],
    ["Cornell Events — Career Fair", "career%20fair"],
    ["Cornell Events — Information Sessions", "information%20session"],
    ["Cornell Events — Internship", "internship"],
  ].map(([name, query]) => ({
    name,
    url: `https://events.cornell.edu/api/2/events/search?search=${query}&days=180&pp=100&distinct=true`,
    kind: "API" as const,
    config: { intervalHours: 6, autoPublishTrusted: true },
  })),
  {
    name: "Cornell Career Fair Days",
    url: "https://career.cornell.edu/cornell-career-fair-days/",
    kind: "WEB_PAGE" as const,
    config: { intervalHours: 12, autoPublishTrusted: true },
  },
  {
    name: "Cornell ILR CAHRS Events",
    url: "https://www.ilr.cornell.edu/cahrs",
    kind: "WEB_PAGE" as const,
    config: {
      maxDetailPages: 10,
      includePathPatterns: ["/cahrs/events/"],
      intervalHours: 12,
      autoPublishTrusted: true,
    },
  },
  {
    name: "Cornell ILR Student Events",
    url: "https://www.ilr.cornell.edu/current-students/student-events-calendar",
    kind: "WEB_PAGE" as const,
    config: {
      maxDetailPages: 10,
      includePathPatterns: ["/events/"],
      intervalHours: 12,
      autoPublishTrusted: true,
    },
  },
  {
    name: "Cornell Graduate Careers Events",
    url: "https://gradcareers.cornell.edu/events/",
    kind: "WEB_PAGE" as const,
    config: {
      maxDetailPages: 10,
      includePathPatterns: ["/event/"],
      intervalHours: 12,
      autoPublishTrusted: true,
    },
  },
] as const;
