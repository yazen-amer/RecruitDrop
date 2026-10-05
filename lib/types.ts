export type EventMode = "IN_PERSON" | "VIRTUAL" | "HYBRID" | "UNKNOWN";
export type EventType =
  | "INFO_SESSION"
  | "TECH_TALK"
  | "COFFEE_CHAT"
  | "INTERVIEW"
  | "CAREER_FAIR"
  | "DEADLINE"
  | "WORKSHOP"
  | "OTHER";
export type RecruitingEvent = {
  id: string;
  slug: string;
  title: string;
  description: string;
  company: string;
  companyKnown?: boolean;
  companyInitials: string;
  companyColor: string;
  startAt: string;
  endAt?: string;
  location?: string;
  mode: EventMode;
  type: EventType;
  categories: string[];
  registrationUrl: string;
  registrationIsDirect?: boolean;
  sources?: { name: string; url: string }[];
  sourceName: string;
  sourceUrl: string;
  discoveredAt: string;
  deadline?: string;
  confidence?: number;
  isMock: boolean;
};
