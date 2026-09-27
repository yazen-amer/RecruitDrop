"use client";

import { useState } from "react";
import { Flag } from "lucide-react";

const reasons = [
  ["NOT_RECRUITING", "Not a recruiting event"], ["WRONG_CATEGORY", "Wrong category"],
  ["EXPIRED", "Expired"], ["DUPLICATE", "Duplicate"], ["BAD_LINK", "Broken link"],
] as const;

export function EventFeedback({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false); const [sent, setSent] = useState(false);
  async function report(reason: string) {
    let deviceId = localStorage.getItem("recruitdrop-device-id");
    if (!deviceId) { deviceId = crypto.randomUUID(); localStorage.setItem("recruitdrop-device-id", deviceId); }
    const response = await fetch("/api/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId, deviceId, reason }) });
    if (response.ok) { setSent(true); setOpen(false); }
  }
  if (sent) return <span className="feedback-thanks">Thanks—report received.</span>;
  return <div className="feedback-control">
    <button className="text-button" onClick={() => setOpen(!open)}><Flag size={14} /> Report a problem</button>
    {open && <div className="feedback-menu">{reasons.map(([value, label]) => <button key={value} onClick={() => report(value)}>{label}</button>)}</div>}
  </div>;
}
